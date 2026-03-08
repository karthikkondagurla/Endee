/**
 * Inverted index for sparse vector similarity search.
 *
 * Blocked on-disk layout in MDBX:
 *   key   = pack(term_id, block_nr) as uint64_t integer-key
 *   value = BlockHeader | doc_offsets[n] (uint16) | values[n] (uint8 or float)
 *
 * Metadata rows in the same DBI:
 *   pack(term_id, UINT32_MAX) -> PostingListHeader
 *
 * The key packing keeps all rows for a term contiguous, so scans can seek once
 * to pack(term_id, 0) and walk until term_id changes.
 */

#include "inverted_index.hpp"

#include <atomic>
#include <chrono>
#include <cmath>

namespace ndd {

    /*TODO: remove this namespace*/
    namespace {
        inline bool nearEqual(float a, float b) {
            return std::fabs(a - b) <= settings::NEAR_ZERO;
        }

        inline void applyHeaderDelta(PostingListHeader& header,
                                    int64_t total_delta,
                                    int64_t live_delta) {
            int64_t new_total = static_cast<int64_t>(header.nr_entries) + total_delta;
            int64_t new_live = static_cast<int64_t>(header.nr_live_entries) + live_delta;

            if (new_total < 0) new_total = 0;
            if (new_live < 0) new_live = 0;
            if (new_live > new_total) new_live = new_total;

            header.nr_entries = static_cast<uint32_t>(new_total);
            header.nr_live_entries = static_cast<uint32_t>(new_live);
        }

#ifdef ND_DEBUG
        using SteadyClock = std::chrono::steady_clock;

        inline uint64_t elapsedNsSince(const SteadyClock::time_point& start) {
            return static_cast<uint64_t>(
                    std::chrono::duration_cast<std::chrono::nanoseconds>(SteadyClock::now() - start)
                            .count());
        }

        struct SparseSearchDebugStats {
            std::atomic<uint64_t> phase3_iterators_visited{0};
            std::atomic<uint64_t> phase3_iterators_contributed{0};
            std::atomic<uint64_t> parse_current_kv_calls{0};
            std::atomic<uint64_t> parse_current_kv_total_ns{0};
        };

        struct SparseUpdateDebugStats {
            std::atomic<uint64_t> add_batch_calls{0};
            std::atomic<uint64_t> add_batch_docs{0};
            std::atomic<uint64_t> add_batch_terms{0};
            std::atomic<uint64_t> add_batch_raw_updates{0};
            std::atomic<uint64_t> add_batch_deduped_updates{0};
            std::atomic<uint64_t> add_batch_blocks{0};
            std::atomic<uint64_t> build_term_updates_total_ns{0};
            std::atomic<uint64_t> sort_dedup_total_ns{0};
            std::atomic<uint64_t> load_block_calls{0};
            std::atomic<uint64_t> load_block_total_ns{0};
            std::atomic<uint64_t> load_block_entries_total{0};
            std::atomic<uint64_t> merge_block_calls{0};
            std::atomic<uint64_t> merge_block_total_ns{0};
            std::atomic<uint64_t> merge_existing_entries_total{0};
            std::atomic<uint64_t> merge_update_entries_total{0};
            std::atomic<uint64_t> merge_output_entries_total{0};
            std::atomic<uint64_t> save_block_calls{0};
            std::atomic<uint64_t> save_block_total_ns{0};
            std::atomic<uint64_t> save_block_entries_total{0};
            std::atomic<uint64_t> recompute_max_calls{0};
            std::atomic<uint64_t> recompute_max_total_ns{0};
        };

        SparseSearchDebugStats& sparseSearchDebugStats() {
            static SparseSearchDebugStats stats;
            return stats;
        }

        SparseUpdateDebugStats& sparseUpdateDebugStats() {
            static SparseUpdateDebugStats stats;
            return stats;
        }

        class ParseCurrentKVTimer {
        public:
            ParseCurrentKVTimer() :
                start_(SteadyClock::now()) {}

            ~ParseCurrentKVTimer() {
                SparseSearchDebugStats& stats = sparseSearchDebugStats();
                stats.parse_current_kv_calls.fetch_add(1, std::memory_order_relaxed);
                stats.parse_current_kv_total_ns.fetch_add(elapsedNsSince(start_),
                                                          std::memory_order_relaxed);
            }

        private:
            SteadyClock::time_point start_;
        };
#endif
    }  // namespace

#ifdef ND_DEBUG
    void printSparseSearchDebugStats() {
        SparseSearchDebugStats& stats = sparseSearchDebugStats();
        const uint64_t visited = stats.phase3_iterators_visited.exchange(0, std::memory_order_relaxed);
        const uint64_t contributed =
                stats.phase3_iterators_contributed.exchange(0, std::memory_order_relaxed);
        const uint64_t parse_calls = stats.parse_current_kv_calls.exchange(0, std::memory_order_relaxed);
        const uint64_t parse_total_ns =
                stats.parse_current_kv_total_ns.exchange(0, std::memory_order_relaxed);

        std::cerr << "\n=== Sparse Search Debug Stats ===\n";
        std::cerr << std::fixed << std::setprecision(3);
        std::cerr << "phase3 iterators visited: " << visited << "\n";
        std::cerr << "phase3 iterators contributed: " << contributed << "\n";
        std::cerr << "phase3 contribution rate(%): "
                  << (visited ? (100.0 * static_cast<double>(contributed) / static_cast<double>(visited))
                              : 0.0)
                  << "\n";
        std::cerr << "parseCurrentKV count: " << parse_calls << "\n";
        std::cerr << "parseCurrentKV total(ms): " << (static_cast<double>(parse_total_ns) / 1'000'000.0)
                  << "\n";
        std::cerr << "parseCurrentKV avg(us): "
                  << (parse_calls ? (static_cast<double>(parse_total_ns) / 1000.0) / static_cast<double>(parse_calls)
                                  : 0.0)
                  << "\n";
        std::cerr << "=================================\n";
    }

    void printSparseUpdateDebugStats() {
        SparseUpdateDebugStats& stats = sparseUpdateDebugStats();
        const uint64_t add_batch_calls = stats.add_batch_calls.exchange(0, std::memory_order_relaxed);
        const uint64_t add_batch_docs = stats.add_batch_docs.exchange(0, std::memory_order_relaxed);
        const uint64_t add_batch_terms = stats.add_batch_terms.exchange(0, std::memory_order_relaxed);
        const uint64_t add_batch_raw_updates =
                stats.add_batch_raw_updates.exchange(0, std::memory_order_relaxed);
        const uint64_t add_batch_deduped_updates =
                stats.add_batch_deduped_updates.exchange(0, std::memory_order_relaxed);
        const uint64_t add_batch_blocks = stats.add_batch_blocks.exchange(0, std::memory_order_relaxed);
        const uint64_t build_term_updates_total_ns =
                stats.build_term_updates_total_ns.exchange(0, std::memory_order_relaxed);
        const uint64_t sort_dedup_total_ns =
                stats.sort_dedup_total_ns.exchange(0, std::memory_order_relaxed);
        const uint64_t load_block_calls = stats.load_block_calls.exchange(0, std::memory_order_relaxed);
        const uint64_t load_block_total_ns =
                stats.load_block_total_ns.exchange(0, std::memory_order_relaxed);
        const uint64_t load_block_entries_total =
                stats.load_block_entries_total.exchange(0, std::memory_order_relaxed);
        const uint64_t merge_block_calls = stats.merge_block_calls.exchange(0, std::memory_order_relaxed);
        const uint64_t merge_block_total_ns =
                stats.merge_block_total_ns.exchange(0, std::memory_order_relaxed);
        const uint64_t merge_existing_entries_total =
                stats.merge_existing_entries_total.exchange(0, std::memory_order_relaxed);
        const uint64_t merge_update_entries_total =
                stats.merge_update_entries_total.exchange(0, std::memory_order_relaxed);
        const uint64_t merge_output_entries_total =
                stats.merge_output_entries_total.exchange(0, std::memory_order_relaxed);
        const uint64_t save_block_calls = stats.save_block_calls.exchange(0, std::memory_order_relaxed);
        const uint64_t save_block_total_ns =
                stats.save_block_total_ns.exchange(0, std::memory_order_relaxed);
        const uint64_t save_block_entries_total =
                stats.save_block_entries_total.exchange(0, std::memory_order_relaxed);
        const uint64_t recompute_max_calls =
                stats.recompute_max_calls.exchange(0, std::memory_order_relaxed);
        const uint64_t recompute_max_total_ns =
                stats.recompute_max_total_ns.exchange(0, std::memory_order_relaxed);

        std::cerr << "\n=== Sparse Update Debug Stats ===\n";
        std::cerr << std::fixed << std::setprecision(3);
        std::cerr << "addDocumentsBatchInternal count: " << add_batch_calls << "\n";
        std::cerr << "addDocumentsBatchInternal docs: " << add_batch_docs << "\n";
        std::cerr << "addDocumentsBatchInternal terms: " << add_batch_terms << "\n";
        std::cerr << "addDocumentsBatchInternal raw updates: " << add_batch_raw_updates << "\n";
        std::cerr << "addDocumentsBatchInternal deduped updates: " << add_batch_deduped_updates << "\n";
        std::cerr << "addDocumentsBatchInternal touched blocks: " << add_batch_blocks << "\n";
        std::cerr << "term_updates build total(ms): "
                  << (static_cast<double>(build_term_updates_total_ns) / 1'000'000.0) << "\n";
        std::cerr << "sort+dedup total(ms): "
                  << (static_cast<double>(sort_dedup_total_ns) / 1'000'000.0) << "\n";
        std::cerr << "loadBlockEntries count: " << load_block_calls << "\n";
        std::cerr << "loadBlockEntries total(ms): "
                  << (static_cast<double>(load_block_total_ns) / 1'000'000.0) << "\n";
        std::cerr << "loadBlockEntries avg(us): "
                  << (load_block_calls
                              ? (static_cast<double>(load_block_total_ns) / 1000.0)
                                      / static_cast<double>(load_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "loadBlockEntries avg existing entries: "
                  << (load_block_calls
                              ? static_cast<double>(load_block_entries_total)
                                      / static_cast<double>(load_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "merge blocks count: " << merge_block_calls << "\n";
        std::cerr << "merge blocks total(ms): "
                  << (static_cast<double>(merge_block_total_ns) / 1'000'000.0) << "\n";
        std::cerr << "merge blocks avg(us): "
                  << (merge_block_calls
                              ? (static_cast<double>(merge_block_total_ns) / 1000.0)
                                      / static_cast<double>(merge_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "merge avg existing entries: "
                  << (merge_block_calls
                              ? static_cast<double>(merge_existing_entries_total)
                                      / static_cast<double>(merge_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "merge avg update entries: "
                  << (merge_block_calls
                              ? static_cast<double>(merge_update_entries_total)
                                      / static_cast<double>(merge_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "merge avg output entries: "
                  << (merge_block_calls
                              ? static_cast<double>(merge_output_entries_total)
                                      / static_cast<double>(merge_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "saveBlockEntries count: " << save_block_calls << "\n";
        std::cerr << "saveBlockEntries total(ms): "
                  << (static_cast<double>(save_block_total_ns) / 1'000'000.0) << "\n";
        std::cerr << "saveBlockEntries avg(us): "
                  << (save_block_calls
                              ? (static_cast<double>(save_block_total_ns) / 1000.0)
                                      / static_cast<double>(save_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "saveBlockEntries avg entries: "
                  << (save_block_calls
                              ? static_cast<double>(save_block_entries_total)
                                      / static_cast<double>(save_block_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "recomputeGlobalMax count: " << recompute_max_calls << "\n";
        std::cerr << "recomputeGlobalMax total(ms): "
                  << (static_cast<double>(recompute_max_total_ns) / 1'000'000.0) << "\n";
        std::cerr << "recomputeGlobalMax avg(us): "
                  << (recompute_max_calls
                              ? (static_cast<double>(recompute_max_total_ns) / 1000.0)
                                      / static_cast<double>(recompute_max_calls)
                              : 0.0)
                  << "\n";
        std::cerr << "=================================\n";
    }
#else
    void printSparseSearchDebugStats() {}
    void printSparseUpdateDebugStats() {}
#endif

    InvertedIndex::InvertedIndex(MDBX_env* env, size_t vocab_size)
        : env_(env), blocked_term_postings_dbi_(0), vocab_size_(vocab_size) {}

    bool InvertedIndex::initialize() {
        std::unique_lock<std::shared_mutex> lock(mutex_);

        MDBX_txn* txn = nullptr;
        int rc = mdbx_txn_begin(env_, nullptr, MDBX_TXN_READWRITE, &txn);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("Failed to begin init transaction: " << mdbx_strerror(rc));
            return false;
        }

        rc = mdbx_dbi_open(txn,
                            "blocked_term_postings",
                            MDBX_CREATE | MDBX_INTEGERKEY,
                            &blocked_term_postings_dbi_);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("Failed to open blocked_term_postings dbi: " << mdbx_strerror(rc));
            mdbx_txn_abort(txn);
            return false;
        }

        rc = mdbx_txn_commit(txn);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("Failed to commit init transaction: " << mdbx_strerror(rc));
            return false;
        }

        return loadTermInfo();
    }

    bool InvertedIndex::addDocumentsBatch(
        MDBX_txn* txn,
        const std::vector<std::pair<ndd::idInt, SparseVector>>& docs)
    {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        return addDocumentsBatchInternal(txn, docs);
    }

    bool InvertedIndex::removeDocument(MDBX_txn* txn,
                                    ndd::idInt doc_id,
                                    const SparseVector& vec)
    {
        std::unique_lock<std::shared_mutex> lock(mutex_);
        return removeDocumentInternal(txn, doc_id, vec);
    }

    size_t InvertedIndex::getTermCount() const {
        return term_info_.size();
    }

    size_t InvertedIndex::getVocabSize() const {
        return vocab_size_;
    }

    std::vector<std::pair<ndd::idInt, float>>
    InvertedIndex::search(const SparseVector& query,
                        size_t k,
                        const ndd::RoaringBitmap* filter)
    {
        std::shared_lock<std::shared_mutex> lock(mutex_);

        MDBX_txn* txn = nullptr;
        int rc = mdbx_txn_begin(env_, nullptr, MDBX_TXN_RDONLY, &txn);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("Failed to begin search transaction: " << mdbx_strerror(rc));
            return {};
        }

        if (query.empty() || k == 0) {
            mdbx_txn_abort(txn);
            return {};
        }

        std::vector<PostingListIterator> iters_storage;
        std::vector<PostingListIterator*> iters;
        std::vector<MDBX_cursor*> cursors;

        iters_storage.reserve(query.indices.size());
        iters.reserve(query.indices.size());
        cursors.reserve(query.indices.size());

        {
            LOG_TIME("search phase 1");

        for (size_t qi = 0; qi < query.indices.size(); qi++) {
            uint32_t term_id = query.indices[qi];
            if (term_id == kMetadataTermId) continue;

            float qw = query.values[qi];
            if (qw <= 0.0f) continue;


            auto info_it = term_info_.find(term_id);
            /*TODO: print a warning that term_id wasn't found*/
            if (info_it == term_info_.end()) continue;

            bool header_found = false;
            PostingListHeader header = readPostingListHeader(txn, term_id, &header_found);
            if (!header_found || header.nr_entries == 0 || header.nr_live_entries == 0) {
                continue;
            }

            MDBX_cursor* cursor = nullptr;
            rc = mdbx_cursor_open(txn, blocked_term_postings_dbi_, &cursor);
            if (rc != MDBX_SUCCESS) {
                continue;
            }

            PostingListIterator it;
            it.init(cursor,
                    term_id,
                    qw,
                    info_it->second,
                    header.nr_entries,
                    this);

            if (it.current_doc_id != EXHAUSTED_DOC_ID) {
                iters_storage.push_back(it);
                cursors.push_back(cursor);
            } else {
                mdbx_cursor_close(cursor);
            }
        }

        for (size_t i = 0; i < iters_storage.size(); i++) {
            iters.push_back(&iters_storage[i]);
        }

        if (iters.empty()) {
            mdbx_txn_abort(txn);
            return {};
        }
        }
        

        bool use_pruning = (iters.size() > 1);
        float best_min_score = 0.0f;

        std::vector<float> scores_buf(settings::INV_IDX_SEARCH_BATCH_SZ, 0.0f);
        std::priority_queue<ScoredDoc> top_results;
        float threshold = 0.0f;

        auto minIterDocId = [&iters]() -> ndd::idInt {
            ndd::idInt min_id = EXHAUSTED_DOC_ID;
            for (size_t i = 0; i < iters.size(); i++) {
                if (iters[i]->current_doc_id < min_id) {
                    min_id = iters[i]->current_doc_id;
                }
            }
            return min_id;
        };

        ndd::idInt min_id = minIterDocId();

        while (min_id != EXHAUSTED_DOC_ID) {
            ndd::idInt batch_start = min_id;
            ndd::idInt batch_end = batch_start
                                + (ndd::idInt)settings::INV_IDX_SEARCH_BATCH_SZ - 1;
            if (batch_end < batch_start) {
                batch_end = EXHAUSTED_DOC_ID - 1;
            }
            const uint32_t batch_end_block_nr = docToBlockNr(batch_end);
            const BlockOffset batch_end_block_offset = docToBlockOffset(batch_end);

            size_t batch_len = (size_t)(batch_end - batch_start) + 1;
            if (batch_len > scores_buf.size()) {
                scores_buf.resize(batch_len);
            }
            std::memset(scores_buf.data(), 0, batch_len * sizeof(float));

            {
            LOG_TIME("search phase 3");
            for (size_t i = 0; i < iters.size(); i++) {
                PostingListIterator* it = iters[i];
#ifdef ND_DEBUG
                sparseSearchDebugStats().phase3_iterators_visited.fetch_add(1, std::memory_order_relaxed);
                bool phase3_contributed = false;
#endif
                if (it->current_doc_id > batch_end) {
                    continue;
                }
                float qw = it->term_weight;

                const BlockOffset* offsets = it->doc_offsets;
                uint32_t idx = it->current_entry_idx;
                uint32_t sz  = it->data_size;

#if defined(NDD_INV_IDX_STORE_FLOATS)
                const float* vals = (const float*)it->values_ptr;
                while (true) {
                    if (it->current_block_nr > batch_end_block_nr) {
                        break;
                    }

                    const bool consume_full_block = it->current_block_nr < batch_end_block_nr;
                    const int64_t local_base =
                            static_cast<int64_t>(it->currentBlockBaseDocId()) - static_cast<int64_t>(batch_start);
                    uint32_t before = idx;
                    while (idx < sz
                          && (consume_full_block || offsets[idx] <= batch_end_block_offset)) {
                        if (vals[idx] > 0.0f) {
                            size_t local = static_cast<size_t>(local_base + offsets[idx]);
                            scores_buf[local] += vals[idx] * qw;
#ifdef ND_DEBUG
                            phase3_contributed = true;
#endif
                        }
                        idx++;
                    }
                    it->consumeEntries(idx - before);

                    if (idx < sz) break;

                    it->current_entry_idx = idx;
                    if (!it->loadNextBlock()) break;

                    offsets = it->doc_offsets;
                    vals = (const float*)it->values_ptr;
                    idx = 0;
                    sz = it->data_size;

                    if (it->current_block_nr > batch_end_block_nr
                       || (it->current_block_nr == batch_end_block_nr
                          && sz > 0
                          && offsets[0] > batch_end_block_offset)) {
                        break;
                    }
                }
#else
                const uint8_t* vals = (const uint8_t*)it->values_ptr;
                float scale = it->max_value / UINT8_MAX;
                while (true) {
                    if (it->current_block_nr > batch_end_block_nr) {
                        break;
                    }

                    const bool consume_full_block = it->current_block_nr < batch_end_block_nr;
                    const int64_t local_base =
                            static_cast<int64_t>(it->currentBlockBaseDocId()) - static_cast<int64_t>(batch_start);
                    uint32_t before = idx;
                    while (idx < sz
                          && (consume_full_block || offsets[idx] <= batch_end_block_offset)) {
                        if (vals[idx] > 0) {
                            size_t local = static_cast<size_t>(local_base + offsets[idx]);
                            scores_buf[local] += ((float)vals[idx] * scale) * qw;
#ifdef ND_DEBUG
                            phase3_contributed = true;
#endif
                        }
                        idx++;
                    }
                    it->consumeEntries(idx - before);

                    if (idx < sz) break;

                    it->current_entry_idx = idx;
                    if (!it->loadNextBlock()) break;

                    offsets = it->doc_offsets;
                    vals = (const uint8_t*)it->values_ptr;
                    scale = it->max_value / UINT8_MAX;
                    idx = 0;
                    sz = it->data_size;

                    if (it->current_block_nr > batch_end_block_nr
                       || (it->current_block_nr == batch_end_block_nr
                          && sz > 0
                          && offsets[0] > batch_end_block_offset)) {
                        break;
                    }
                }
#endif //NDD_INV_IDX_STORE_FLOATS

                it->current_entry_idx = idx;
                it->advanceToNextLive();
#ifdef ND_DEBUG
                if (phase3_contributed) {
                    sparseSearchDebugStats().phase3_iterators_contributed.fetch_add(
                            1, std::memory_order_relaxed);
                }
#endif
            }
            }

            {
                LOG_TIME("search phase 4");
            for (size_t local = 0; local < batch_len; local++) {
                float s = scores_buf[local];
                if (s == 0.0f || s <= threshold) continue;

                ndd::idInt doc_id = batch_start + (ndd::idInt)local;
                if (filter && !filter->contains(doc_id)) continue;

                if (top_results.size() < k) {
                    top_results.emplace(doc_id, s);
                    if (top_results.size() == k) {
                        threshold = top_results.top().score;
                    }
                } else if (s > threshold) {
                    top_results.pop();
                    top_results.emplace(doc_id, s);
                    threshold = top_results.top().score;
                }
            }
            }

            {
                LOG_TIME("search phase 5");
            size_t write_idx = 0;
            for (size_t i = 0; i < iters.size(); i++) {
                if (iters[i]->current_doc_id != EXHAUSTED_DOC_ID) {
                    iters[write_idx++] = iters[i];
                }
            }
            iters.resize(write_idx);
            if (iters.empty()) break;

            min_id = minIterDocId();

            if (use_pruning && top_results.size() >= k) {
                float new_min_score = threshold;
                if (!nearEqual(new_min_score, best_min_score)) {
                    best_min_score = new_min_score;
                    pruneLongest(iters, new_min_score);
                    min_id = minIterDocId();
                }
            }
            }
        }

#ifdef NDD_INV_IDX_PRUNE_DEBUG
        for (const PostingListIterator& it : iters_storage) {
            LOG_INFO("sparse_prune term_id=" << it.term_id
                    << " posting_list_len=" << it.initial_entries
                    << " pruned_len=" << it.pruned_entries);
        }
#endif

        for (MDBX_cursor* cursor : cursors) {
            mdbx_cursor_close(cursor);
        }
        mdbx_txn_abort(txn);

        std::vector<std::pair<ndd::idInt, float>> results;
        results.reserve(top_results.size());
        while (!top_results.empty()) {
            results.push_back(
                std::make_pair(top_results.top().doc_id, top_results.top().score));
            top_results.pop();
        }
        std::reverse(results.begin(), results.end());
        return results;
    }

    inline uint8_t InvertedIndex::quantize(float val, float max_val) {
        if (max_val <= settings::NEAR_ZERO)
            return 0;

        float scaled = (val / max_val) * UINT8_MAX;
        if (scaled >= UINT8_MAX)
            return UINT8_MAX;
        if (scaled <= 0.0f)
            return 0;

        uint8_t result = (uint8_t)(scaled + 0.5f);
        return result == 0 ? 1 : result;
    }

    inline float InvertedIndex::dequantize(uint8_t val, float max_val) {
        if (max_val <= settings::NEAR_ZERO)
            return 0.0f;
        return (float)val * (max_val / UINT8_MAX);
    }

    // =========================================================================
    // SIMD helpers
    // =========================================================================

    size_t InvertedIndex::findDocIdSIMD(const uint32_t* doc_ids,
                                    size_t size,
                                    size_t start_idx,
                                    uint32_t target) const
    {
        size_t idx = start_idx;

#if defined(USE_AVX512)
        const size_t simd_width = 16;
        __m512i target_vec = _mm512_set1_epi32((int)target);

        while (idx + simd_width <= size) {
            __m512i data_vec = _mm512_loadu_si512(doc_ids + idx);
            __mmask16 mask = _mm512_cmpge_epu32_mask(data_vec, target_vec);

            if (mask != 0) {
                return idx + __builtin_ctz(mask);
            }
            idx += simd_width;
        }
#elif defined(USE_AVX2)
        const size_t simd_width = 8;
        __m256i target_vec = _mm256_set1_epi32((int)target);

        while (idx + simd_width <= size) {
            __builtin_prefetch(doc_ids + idx + 32);
            if (doc_ids[idx + simd_width - 1] < target) {
                idx += simd_width;
                continue;
            }

            __m256i data_vec =
                _mm256_loadu_si256((const __m256i*)(doc_ids + idx));
            __m256i max_vec = _mm256_max_epu32(data_vec, target_vec);
            __m256i cmp = _mm256_cmpeq_epi32(max_vec, data_vec);

            int mask = _mm256_movemask_ps(_mm256_castsi256_ps(cmp));
            if (mask != 0) {
                return idx + __builtin_ctz(mask);
            }
            idx += simd_width;
        }
#elif defined(USE_SVE2)
        svbool_t pg = svwhilelt_b32(idx, size);
        svuint32_t target_vec = svdup_u32(target);

        while (svptest_any(svptrue_b32(), pg)) {
            svuint32_t data_vec = svld1_u32(pg, doc_ids + idx);
            svbool_t cmp = svcmpge_u32(pg, data_vec, target_vec);

            if (svptest_any(pg, cmp)) {
                svbool_t before_match = svbrkb_z(pg, cmp);
                uint64_t count = svcntp_b32(pg, before_match);
                return idx + count;
            }
            idx += svcntw();
            pg = svwhilelt_b32(idx, size);
        }
        return idx;
#elif defined(USE_NEON)
        const size_t simd_width = 4;
        uint32x4_t target_vec = vdupq_n_u32(target);

        while (idx + simd_width <= size) {
            uint32x4_t data_vec = vld1q_u32(doc_ids + idx);
            uint32x4_t cmp = vcgeq_u32(data_vec, target_vec);

            if (vmaxvq_u32(cmp) != 0) {
                for (size_t i = 0; i < simd_width; i++) {
                    if (doc_ids[idx + i] >= target) {
                        return idx + i;
                    }
                }
            }
            idx += simd_width;
        }
#endif

        while (idx < size && doc_ids[idx] < target) {
            idx++;
        }
        return idx;
    }

    size_t InvertedIndex::findNextLiveSIMD(const uint8_t* values,
                                        size_t size,
                                        size_t start_idx) const
    {
        size_t idx = start_idx;

#if defined(USE_AVX512)
        const size_t simd_width = 64;
        __m512i zero_vec = _mm512_setzero_si512();

        while (idx + simd_width <= size) {
            __m512i data_vec = _mm512_loadu_si512(values + idx);
            __mmask64 mask = _mm512_cmpneq_epu8_mask(data_vec, zero_vec);

            if (mask != 0) {
                return idx + __builtin_ctzll(mask);
            }
            idx += simd_width;
        }
#elif defined(USE_AVX2)
        const size_t simd_width = 32;
        __m256i zero_vec = _mm256_setzero_si256();

        while (idx + simd_width <= size) {
            __m256i data_vec =
                _mm256_loadu_si256((const __m256i*)(values + idx));
            __m256i cmp = _mm256_cmpeq_epi8(data_vec, zero_vec);
            int mask = _mm256_movemask_epi8(cmp);

            if ((uint32_t)mask != 0xFFFFFFFF) {
                return idx + __builtin_ctz(~mask);
            }
            idx += simd_width;
        }
#elif defined(USE_NEON)
        const size_t simd_width = 16;
        uint8x16_t zero_vec = vdupq_n_u8(0);

        while (idx + simd_width <= size) {
            uint8x16_t data_vec = vld1q_u8(values + idx);
            uint8x16_t cmp = vceqq_u8(data_vec, zero_vec);

            if (vminvq_u8(cmp) == 0) {
                for (size_t i = 0; i < simd_width; i++) {
                    if (values[idx + i] != 0) {
                        return idx + i;
                    }
                }
            }
            idx += simd_width;
        }
#elif defined(USE_SVE2)
        svbool_t pg = svwhilelt_b8(idx, size);
        while (svptest_any(svptrue_b8(), pg)) {
            svuint8_t data_vec = svld1_u8(pg, values + idx);
            svbool_t cmp = svcmpne_n_u8(pg, data_vec, 0);

            if (svptest_any(pg, cmp)) {
                svbool_t before_match = svbrkb_z(pg, cmp);
                return idx + svcntp_b8(pg, before_match);
            }
            idx += svcntb();
            pg = svwhilelt_b8(idx, size);
        }
        return idx;
#endif

        while (idx < size) {
            if (values[idx] != 0) return idx;
            idx++;
        }
        return idx;
    }

    // =========================================================================
    // Metadata and block helpers
    // =========================================================================

    PostingListHeader InvertedIndex::readPostingListHeader(MDBX_txn* txn,
                                                            uint32_t term_id,
                                                            bool* out_found) const {
        PostingListHeader header;
        if (out_found) *out_found = false;

        if (term_id == kMetadataTermId) {
            return header;
        }

        uint64_t packed = packPostingKey(term_id, kMetadataBlockNr);
        MDBX_val key{&packed, sizeof(packed)};
        MDBX_val data;

        int rc = mdbx_get(txn, blocked_term_postings_dbi_, &key, &data);
        if (rc == MDBX_SUCCESS && data.iov_len >= sizeof(PostingListHeader)) {
            std::memcpy(&header, data.iov_base, sizeof(PostingListHeader));
            if (out_found) *out_found = true;
        }

        return header;
    }

    bool InvertedIndex::writePostingListHeader(MDBX_txn* txn,
                                            uint32_t term_id,
                                            const PostingListHeader& header) {
        if (term_id == kMetadataTermId) {
            LOG_ERROR("Refusing to write posting-list header for reserved metadata term");
            return false;
        }

        uint64_t packed = packPostingKey(term_id, kMetadataBlockNr);
        MDBX_val key{&packed, sizeof(packed)};
        MDBX_val data{const_cast<PostingListHeader*>(&header), sizeof(PostingListHeader)};

        int rc = mdbx_put(txn, blocked_term_postings_dbi_, &key, &data, MDBX_UPSERT);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("Failed to write posting-list header for term " << term_id
                        << ": " << mdbx_strerror(rc));
            return false;
        }

        return true;
    }

    bool InvertedIndex::deletePostingListHeader(MDBX_txn* txn, uint32_t term_id) {
        uint64_t packed = packPostingKey(term_id, kMetadataBlockNr);
        MDBX_val key{&packed, sizeof(packed)};

        int rc = mdbx_del(txn, blocked_term_postings_dbi_, &key, nullptr);
        return rc == MDBX_SUCCESS || rc == MDBX_NOTFOUND;
    }

    bool InvertedIndex::parseBlockViewFromValue(const MDBX_val& data,
                                                uint32_t block_nr,
                                                BlockView* out_view) const {
        if (!out_view) return false;
        if (data.iov_len < sizeof(BlockHeader)) return false;

        const BlockHeader* header = (const BlockHeader*)data.iov_base;
        if (header->version != kOnDiskVersion) {
            LOG_ERROR("Sparse data version not matching : " << kOnDiskVersion);
            return false;
        }

        uint32_t n = header->nr_entries;

        const uint8_t* ptr = (const uint8_t*)data.iov_base + sizeof(BlockHeader);
        const BlockOffset* doc_offsets = reinterpret_cast<const BlockOffset*>(ptr);
        ptr += n * sizeof(BlockOffset);

#if defined(NDD_INV_IDX_STORE_FLOATS)
        uint8_t vbits = 32;
        const void* values = ptr;
        size_t required = sizeof(BlockHeader)
                        + n * sizeof(BlockOffset)
                        + n * sizeof(float);
#else
        uint8_t vbits = 8;
        const void* values = ptr;
        size_t required = sizeof(BlockHeader)
                        + n * sizeof(BlockOffset)
                        + n * sizeof(uint8_t);
#endif //NDD_INV_IDX_STORE_FLOATS

        if (data.iov_len < required) {
            LOG_ERROR("data is corrupt. Not enough bytes as expected");
            return false;
        }

        out_view->doc_offsets = doc_offsets;
        out_view->values = values;
        out_view->count = n;
        out_view->value_bits = vbits;
        out_view->max_value = header->max_value;
        return true;
    }

    bool InvertedIndex::loadBlockEntries(MDBX_txn* txn,
                                        uint32_t term_id,
                                        uint32_t block_nr,
                                        std::vector<PostingListEntry>* entries,
                                        uint32_t* out_live_count,
                                        float* out_max_value,
                                        bool* out_found) const
    {
        if (entries) entries->clear();
        if (out_live_count) *out_live_count = 0;
        if (out_max_value) *out_max_value = 0.0f;
        if (out_found) *out_found = false;

        if (term_id == kMetadataTermId || block_nr == kMetadataBlockNr) {
            return false;
        }

        uint64_t packed = packPostingKey(term_id, block_nr);
        MDBX_val key{&packed, sizeof(packed)};
        MDBX_val data;

        int rc = mdbx_get(txn, blocked_term_postings_dbi_, &key, &data);
        if (rc == MDBX_NOTFOUND) {
            return true;
        }
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("loadBlockEntries mdbx_get failed for term " << term_id
                        << " block " << block_nr << ": " << mdbx_strerror(rc));
            return false;
        }

        BlockView view;
        if (!parseBlockViewFromValue(data, block_nr, &view)) {
            LOG_ERROR("Corrupt block payload for term " << term_id
                        << " block " << block_nr);
            return false;
        }

        const BlockHeader* header = (const BlockHeader*)data.iov_base;
        if (out_live_count) *out_live_count = header->nr_live_entries;
        if (out_max_value) *out_max_value = header->max_value;
        if (out_found) *out_found = true;

        if (!entries) {
            return true;
        }

        entries->resize(view.count);
#if defined(NDD_INV_IDX_STORE_FLOATS)
        const float* vals = (const float*)view.values;
#else
        const uint8_t* vals = (const uint8_t*)view.values;
#endif //NDD_INV_IDX_STORE_FLOATS

        for (uint32_t i = 0; i < view.count; i++) {
            entries->at(i).doc_id = blockOffsetToDocId(block_nr, view.doc_offsets[i]);
#if defined(NDD_INV_IDX_STORE_FLOATS)
            entries->at(i).value = vals[i];
#else
            entries->at(i).value = dequantize(vals[i], header->max_value);
#endif //NDD_INV_IDX_STORE_FLOATS
        }

        return true;
    }

    bool InvertedIndex::saveBlockEntries(MDBX_txn* txn,
                                        uint32_t term_id,
                                        uint32_t block_nr,
                                        const std::vector<PostingListEntry>& entries,
                                        uint32_t live_count,
                                        float max_val)
    {
        if (term_id == kMetadataTermId || block_nr == kMetadataBlockNr) {
            LOG_ERROR("saveBlockEntries: Refusing to save reserved metadata key as a data block");
            return false;
        }

        if (entries.empty()) {
            return deleteBlock(txn, term_id, block_nr);
        }

        if (entries.size() > kBlockCapacity) {
            LOG_ERROR("Block for term " << term_id << " block " << block_nr
                        << " exceeds fixed capacity " << kBlockCapacity);
            return false;
        }

        BlockHeader header;
        header.version = kOnDiskVersion;
        header.nr_entries = (uint16_t)entries.size();
        header.nr_live_entries = (uint16_t)live_count;
        header.max_value = max_val;

#if defined(NDD_INV_IDX_STORE_FLOATS)
        size_t value_size = sizeof(float);
#else
        size_t value_size = sizeof(uint8_t);
#endif //NDD_INV_IDX_STORE_FLOATS

        size_t total_size = sizeof(BlockHeader)
                            + (entries.size() * sizeof(BlockOffset)) //doc-local offsets
                            + (entries.size() * value_size); //doc weights
        std::vector<uint8_t> buffer(total_size);

        std::memcpy(buffer.data(), &header, sizeof(BlockHeader));

        uint8_t* ptr = buffer.data() + sizeof(BlockHeader);
        BlockOffset* offsets_out = reinterpret_cast<BlockOffset*>(ptr);
        ptr += entries.size() * sizeof(BlockOffset);

        BlockOffset prev_offset = 0;
        bool has_prev = false;
        for (size_t i = 0; i < entries.size(); i++) {
            if (docToBlockNr(entries[i].doc_id) != block_nr) {
                LOG_ERROR("Entry doc_id " << entries[i].doc_id
                            << " does not belong to term " << term_id
                            << " block " << block_nr);
                return false;
            }

            BlockOffset offset = docToBlockOffset(entries[i].doc_id);
            if (has_prev && offset <= prev_offset) {
                LOG_ERROR("Block entries must be strictly sorted by doc offset");
                return false;
            }
            offsets_out[i] = offset;
            prev_offset = offset;
            has_prev = true;
        }

#if defined(NDD_INV_IDX_STORE_FLOATS)
        float* vals_out = (float*)ptr;
        for (size_t i = 0; i < entries.size(); i++) {
            vals_out[i] = entries[i].value;
        }
#else
        uint8_t* vals_out = ptr;
        for (size_t i = 0; i < entries.size(); i++) {
            vals_out[i] = quantize(entries[i].value, max_val);
        }
#endif //NDD_INV_IDX_STORE_FLOATS

        uint64_t packed = packPostingKey(term_id, block_nr);
        MDBX_val key{&packed, sizeof(packed)};
        MDBX_val value{buffer.data(), buffer.size()};

        int rc = mdbx_put(txn, blocked_term_postings_dbi_, &key, &value, MDBX_UPSERT);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("saveBlockEntries mdbx_put failed for term " << term_id
                        << " block " << block_nr << ": " << mdbx_strerror(rc));
            return false;
        }

        return true;
    }

    bool InvertedIndex::deleteBlock(MDBX_txn* txn, uint32_t term_id, uint32_t block_nr) {
        uint64_t packed = packPostingKey(term_id, block_nr);
        MDBX_val key{&packed, sizeof(packed)};

        int rc = mdbx_del(txn, blocked_term_postings_dbi_, &key, nullptr);
        return rc == MDBX_SUCCESS || rc == MDBX_NOTFOUND;
    }

    bool InvertedIndex::iterateTermBlocks(
        MDBX_txn* txn,
        uint32_t term_id,
        const std::function<bool(uint32_t block_nr, const MDBX_val& data)>& callback) const {
        MDBX_cursor* cursor = nullptr;
        int rc = mdbx_cursor_open(txn, blocked_term_postings_dbi_, &cursor);
        if (rc != MDBX_SUCCESS) {
            return false;
        }

        uint64_t seek_packed = packPostingKey(term_id, 0);
        MDBX_val key{&seek_packed, sizeof(seek_packed)};
        MDBX_val data;

        rc = mdbx_cursor_get(cursor, &key, &data, MDBX_SET_RANGE);
        while (rc == MDBX_SUCCESS) {
            if (key.iov_len != sizeof(uint64_t)) {
                break;
            }

            uint64_t packed_key;
            std::memcpy(&packed_key, key.iov_base, sizeof(uint64_t));
            uint32_t key_term = unpackTermId(packed_key);
            uint32_t block_nr = unpackBlockNr(packed_key);

            if (key_term != term_id) {
                break;
            }

            if (block_nr == kMetadataBlockNr) {
                break;
            }

            if (!callback(block_nr, data)) {
                mdbx_cursor_close(cursor);
                return false;
            }

            rc = mdbx_cursor_get(cursor, &key, &data, MDBX_NEXT);
        }

        mdbx_cursor_close(cursor);
        return true;
    }

    float InvertedIndex::recomputeGlobalMaxFromBlocks(MDBX_txn* txn, uint32_t term_id) const {
        float recomputed_max = 0.0f;

        bool ok = iterateTermBlocks(txn,
                                    term_id,
                                    [&recomputed_max](uint32_t block_nr, const MDBX_val& data) {
                                        if (data.iov_len < sizeof(BlockHeader)) {
                                            return false;
                                        }
                                        const BlockHeader* header =
                                            (const BlockHeader*)data.iov_base;
                                        if (header->version != kOnDiskVersion) {
                                            return false;
                                        }
                                        if (header->max_value > recomputed_max) {
                                            recomputed_max = header->max_value;
                                        }
                                        return true;
                                    });

        if (!ok) {
            return 0.0f;
        }

        return recomputed_max;
    }

    bool InvertedIndex::deleteAllBlocksForTerm(MDBX_txn* txn, uint32_t term_id) {
        std::vector<uint32_t> block_nrs;
        bool ok = iterateTermBlocks(txn,
                                    term_id,
                                    [&block_nrs](uint32_t block_nr, const MDBX_val&) {
                                        block_nrs.push_back(block_nr);
                                        return true;
                                    });
        if (!ok) return false;

        for (uint32_t block_nr : block_nrs) {
            if (!deleteBlock(txn, term_id, block_nr)) {
                return false;
            }
        }

        return true;
    }

    // =========================================================================
    // Startup
    // =========================================================================

    bool InvertedIndex::loadTermInfo() {
        term_info_.clear();

        MDBX_txn* txn = nullptr;
        int rc = mdbx_txn_begin(env_, nullptr, MDBX_TXN_RDONLY, &txn);
        if (rc != MDBX_SUCCESS) {
            LOG_ERROR("Failed to begin transaction for loadTermInfo: " << mdbx_strerror(rc));
            return false;
        }

        MDBX_cursor* cursor = nullptr;
        rc = mdbx_cursor_open(txn, blocked_term_postings_dbi_, &cursor);
        if (rc != MDBX_SUCCESS) {
            mdbx_txn_abort(txn);
            return false;
        }

        MDBX_val key, data;
        rc = mdbx_cursor_get(cursor, &key, &data, MDBX_FIRST);
        while (rc == MDBX_SUCCESS) {
            if (key.iov_len == sizeof(uint64_t)) {
                uint64_t packed_key;
                std::memcpy(&packed_key, key.iov_base, sizeof(uint64_t));

                uint32_t term_id = unpackTermId(packed_key);
                uint32_t block_nr = unpackBlockNr(packed_key);

                if (term_id != kMetadataTermId
                    && block_nr == kMetadataBlockNr
                    && data.iov_len >= sizeof(PostingListHeader)) {
                    PostingListHeader header;
                    std::memcpy(&header, data.iov_base, sizeof(PostingListHeader));

                    if (header.nr_live_entries > 0 && header.max_value > settings::NEAR_ZERO) {
                        term_info_[term_id] = header.max_value;
                    }
                }
            }

            rc = mdbx_cursor_get(cursor, &key, &data, MDBX_NEXT);
        }

        mdbx_cursor_close(cursor);
        mdbx_txn_abort(txn);
        return true;
    }

    // =========================================================================
    // Add / remove internals
    // =========================================================================

    bool InvertedIndex::addDocumentsBatchInternal(
        MDBX_txn* txn,
        const std::vector<std::pair<ndd::idInt, SparseVector>>& docs)
    {
        if (docs.empty()) return true;

#ifdef ND_DEBUG
        SparseUpdateDebugStats& update_stats = sparseUpdateDebugStats();
        update_stats.add_batch_calls.fetch_add(1, std::memory_order_relaxed);
        update_stats.add_batch_docs.fetch_add(docs.size(), std::memory_order_relaxed);
        uint64_t raw_update_count = 0;
        const auto build_term_updates_start = SteadyClock::now();
#endif
        std::unordered_map<uint32_t, std::vector<std::pair<ndd::idInt, float>>> term_updates;

        for (const auto& [doc_id, sparse_vec] : docs) {
#ifdef ND_DEBUG
            raw_update_count += sparse_vec.indices.size();
#endif
            for (size_t i = 0; i < sparse_vec.indices.size(); i++) {
                uint32_t term_id = sparse_vec.indices[i];
                if (term_id == kMetadataTermId) {
                    LOG_ERROR("term_id UINT32_MAX is reserved for sparse metadata");
                    return false;
                }
                term_updates[term_id].push_back(std::make_pair(doc_id, sparse_vec.values[i]));
            }
        }

#ifdef ND_DEBUG
        update_stats.add_batch_raw_updates.fetch_add(raw_update_count, std::memory_order_relaxed);
        update_stats.add_batch_terms.fetch_add(term_updates.size(), std::memory_order_relaxed);
        update_stats.build_term_updates_total_ns.fetch_add(
                elapsedNsSince(build_term_updates_start), std::memory_order_relaxed);
#endif

        for (auto& [term_id, updates] : term_updates) {
#ifdef ND_DEBUG
            const auto sort_dedup_start = SteadyClock::now();
#endif
            std::sort(updates.begin(), updates.end(),
                    [](const auto& a, const auto& b) { return a.first < b.first; });

            // Keep only the last update per doc_id if duplicates are found.
            std::vector<std::pair<ndd::idInt, float>> deduped;
            deduped.reserve(updates.size());
            for (const auto& u : updates) {
                if (!deduped.empty() && deduped.back().first == u.first) {
                    deduped.back().second = u.second;
                } else {
                    deduped.push_back(u);
                }
            }

#ifdef ND_DEBUG
            update_stats.sort_dedup_total_ns.fetch_add(
                    elapsedNsSince(sort_dedup_start), std::memory_order_relaxed);
            update_stats.add_batch_deduped_updates.fetch_add(
                    deduped.size(), std::memory_order_relaxed);
#endif

            bool header_found = false;
            PostingListHeader header = readPostingListHeader(txn, term_id, &header_found);
            float old_global_max = header.max_value;
            bool need_recompute_max = false;

            size_t ui = 0;
            while (ui < deduped.size()) {
                uint32_t block_nr = docToBlockNr(deduped[ui].first);
                size_t block_begin = ui;
                while (ui < deduped.size() && docToBlockNr(deduped[ui].first) == block_nr) {
                    ui++;
                }

#ifdef ND_DEBUG
                update_stats.add_batch_blocks.fetch_add(1, std::memory_order_relaxed);
#endif
                std::vector<std::pair<ndd::idInt, float>> block_updates(
                    deduped.begin() + block_begin, deduped.begin() + ui);

                std::vector<PostingListEntry> existing;
                uint32_t old_live_count = 0;
                float old_block_max = 0.0f;
                bool block_found = false;
#ifdef ND_DEBUG
                const auto load_block_start = SteadyClock::now();
#endif
                bool load_ok = loadBlockEntries(txn,
                                                term_id,
                                                block_nr,
                                                &existing,
                                                &old_live_count,
                                                &old_block_max,
                                                &block_found);
#ifdef ND_DEBUG
                update_stats.load_block_calls.fetch_add(1, std::memory_order_relaxed);
                update_stats.load_block_total_ns.fetch_add(
                        elapsedNsSince(load_block_start), std::memory_order_relaxed);
                update_stats.load_block_entries_total.fetch_add(
                        existing.size(), std::memory_order_relaxed);
#endif
                if (!load_ok) {
                    return false;
                }

#ifdef ND_DEBUG
                const auto merge_start = SteadyClock::now();
#endif
                std::vector<PostingListEntry> merged;
                merged.reserve(existing.size() + block_updates.size());

                size_t ei = 0;
                size_t bi = 0;
                while (ei < existing.size() && bi < block_updates.size()) {
                    ndd::idInt existing_id = existing[ei].doc_id;
                    ndd::idInt update_id = block_updates[bi].first;

                    if (existing_id < update_id) {
                        merged.push_back(existing[ei]);
                        ei++;
                    } else if (existing_id > update_id) {
                        merged.push_back(PostingListEntry(update_id, block_updates[bi].second));
                        bi++;
                    } else {
                        merged.push_back(PostingListEntry(update_id, block_updates[bi].second));
                        ei++;
                        bi++;
                    }
                }
                while (ei < existing.size()) {
                    merged.push_back(existing[ei]);
                    ei++;
                }
                while (bi < block_updates.size()) {
                    merged.push_back(PostingListEntry(block_updates[bi].first,
                                                        block_updates[bi].second));
                    bi++;
                }

                uint32_t new_live_count = 0;
                float new_block_max = 0.0f;
                for (const auto& e : merged) {
                    if (e.value > 0.0f) {
                        new_live_count++;
                        if (e.value > new_block_max) new_block_max = e.value;
                    }
                    //TODO: Delete an entry if e.value == 0
                    //TODO: print a NOTSUPPORTED warning if e.value < 0 
                }

#ifdef ND_DEBUG
                update_stats.merge_block_calls.fetch_add(1, std::memory_order_relaxed);
                update_stats.merge_block_total_ns.fetch_add(
                        elapsedNsSince(merge_start), std::memory_order_relaxed);
                update_stats.merge_existing_entries_total.fetch_add(
                        existing.size(), std::memory_order_relaxed);
                update_stats.merge_update_entries_total.fetch_add(
                        block_updates.size(), std::memory_order_relaxed);
                update_stats.merge_output_entries_total.fetch_add(
                        merged.size(), std::memory_order_relaxed);
#endif

                uint32_t old_total = static_cast<uint32_t>(existing.size());
                uint32_t new_total = static_cast<uint32_t>(merged.size());
                applyHeaderDelta(header,
                                static_cast<int64_t>(new_total) - static_cast<int64_t>(old_total),
                                static_cast<int64_t>(new_live_count)
                                    - static_cast<int64_t>(old_live_count));

                if (merged.empty()) {
                    if (!deleteBlock(txn, term_id, block_nr)) return false;
                } else {
#ifdef ND_DEBUG
                    const auto save_block_start = SteadyClock::now();
#endif
                    bool save_ok = saveBlockEntries(txn,
                                                    term_id,
                                                    block_nr,
                                                    merged,
                                                    new_live_count,
                                                    new_block_max);
#ifdef ND_DEBUG
                    update_stats.save_block_calls.fetch_add(1, std::memory_order_relaxed);
                    update_stats.save_block_total_ns.fetch_add(
                            elapsedNsSince(save_block_start), std::memory_order_relaxed);
                    update_stats.save_block_entries_total.fetch_add(
                            merged.size(), std::memory_order_relaxed);
#endif
                    if (!save_ok) {
                        return false;
                    }
                }

                if (new_block_max > header.max_value) {
                    header.max_value = new_block_max;
                }

                /**
                 * if the old_global_max was from this block's max and
                 * if this block's max has changed and
                 * if the new block max is less than old_global_max
                 * then we need to recompute the global max.
                 *
                 * recompute global max once all the blocks have been updated
                 * from this document batch.
                 */
                if (old_block_max > 0.0f && nearEqual(old_block_max, old_global_max)
                    && new_block_max + settings::NEAR_ZERO < old_global_max) {
                    need_recompute_max = true;
                }
            }

            if (header.nr_entries == 0) {
                if (!deletePostingListHeader(txn, term_id)) return false;
                term_info_.erase(term_id);
                continue;
            }

            /**
             * Do this only if there are some live entries.
             * else this is wasted effort.
             */
            if (need_recompute_max) {
#ifdef ND_DEBUG
                const auto recompute_max_start = SteadyClock::now();
#endif
                header.max_value = recomputeGlobalMaxFromBlocks(txn, term_id);
#ifdef ND_DEBUG
                update_stats.recompute_max_calls.fetch_add(1, std::memory_order_relaxed);
                update_stats.recompute_max_total_ns.fetch_add(
                        elapsedNsSince(recompute_max_start), std::memory_order_relaxed);
#endif
            }

            if (header.nr_live_entries == 0) {
                header.max_value = 0.0f;
            }

            if (!writePostingListHeader(txn, term_id, header)) {
                return false;
            }

            if (header.nr_live_entries > 0 && header.max_value > settings::NEAR_ZERO) {
                term_info_[term_id] = header.max_value;
            } else {
                term_info_.erase(term_id);
            }
        }

        return true;
    }

    bool InvertedIndex::removeDocumentInternal(MDBX_txn* txn,
                                            ndd::idInt doc_id,
                                            const SparseVector& vec)
    {
        for (size_t i = 0; i < vec.indices.size(); i++) {
            uint32_t term_id = vec.indices[i];
            if (term_id == kMetadataTermId) continue;

            bool header_found = false;
            PostingListHeader header = readPostingListHeader(txn, term_id, &header_found);
            if (!header_found || header.nr_entries == 0) continue;

            uint32_t block_nr = docToBlockNr(doc_id);

            std::vector<PostingListEntry> entries;
            uint32_t old_live_count = 0;
            float old_block_max = 0.0f;
            bool block_found = false;

            if (!loadBlockEntries(txn,
                                term_id,
                                block_nr,
                                &entries,
                                &old_live_count,
                                &old_block_max,
                                &block_found)) {
                return false;
            }
            if (!block_found || entries.empty()) continue;

            size_t lo = 0;
            size_t hi = entries.size();
            while (lo < hi) {
                size_t mid = lo + (hi - lo) / 2;
                if (entries[mid].doc_id < doc_id) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }

            if (lo >= entries.size() || entries[lo].doc_id != doc_id) {
                continue;
            }

            if (entries[lo].value <= 0.0f) {
                continue;
            }

            entries[lo].value = 0.0f;

            uint32_t new_live_count = old_live_count > 0 ? old_live_count - 1 : 0;
            uint32_t old_total = static_cast<uint32_t>(entries.size());

            float tombstone_ratio = old_total > 0
                ? (float)(old_total - new_live_count) / (float)old_total
                : 0.0f;

            if (tombstone_ratio >= settings::INV_IDX_COMPACTION_TOMBSTONE_RATIO) {
                size_t write = 0;
                for (size_t j = 0; j < entries.size(); j++) {
                    if (entries[j].value > 0.0f) {
                        entries[write++] = entries[j];
                    }
                }
                entries.resize(write);
            }

            new_live_count = 0;
            float new_block_max = 0.0f;
            for (const auto& e : entries) {
                if (e.value > 0.0f) {
                    new_live_count++;
                    if (e.value > new_block_max) new_block_max = e.value;
                }
            }

            uint32_t new_total = static_cast<uint32_t>(entries.size());
            applyHeaderDelta(header,
                            static_cast<int64_t>(new_total) - static_cast<int64_t>(old_total),
                            static_cast<int64_t>(new_live_count)
                                - static_cast<int64_t>(old_live_count));

            bool need_recompute_max = false;
            if (old_block_max > 0.0f && nearEqual(old_block_max, header.max_value)
                && new_block_max + settings::NEAR_ZERO < header.max_value) {
                need_recompute_max = true;
            }

            if (entries.empty()) {
                if (!deleteBlock(txn, term_id, block_nr)) return false;
            } else {
                if (!saveBlockEntries(txn,
                                    term_id,
                                    block_nr,
                                    entries,
                                    new_live_count,
                                    new_block_max)) {
                    return false;
                }
            }

            if (header.nr_entries == 0) {
                if (!deletePostingListHeader(txn, term_id)) return false;
                term_info_.erase(term_id);
                continue;
            }

            if (need_recompute_max) {
                header.max_value = recomputeGlobalMaxFromBlocks(txn, term_id);
            }

            if (header.nr_live_entries == 0) {
                header.max_value = 0.0f;
            }

            if (!writePostingListHeader(txn, term_id, header)) {
                return false;
            }

            if (header.nr_live_entries > 0 && header.max_value > settings::NEAR_ZERO) {
                term_info_[term_id] = header.max_value;
            } else {
                term_info_.erase(term_id);
            }
        }

        return true;
    }

    // =========================================================================
    // Pruning
    // =========================================================================

    void InvertedIndex::pruneLongest(std::vector<PostingListIterator*>& iters,
                                float min_score)
    {
        if (iters.size() < 2) return;

        size_t longest_idx = 0;
        uint32_t longest_rem = 0;
        for (size_t i = 0; i < iters.size(); i++) {
            uint32_t rem = iters[i]->remainingEntries();
            if (rem > longest_rem) {
                longest_rem = rem;
                longest_idx = i;
            }
        }

        if (longest_idx != 0) {
            PostingListIterator* tmp = iters[0];
            iters[0] = iters[longest_idx];
            iters[longest_idx] = tmp;
        }

        PostingListIterator* longest = iters[0];
        if (longest->current_doc_id == EXHAUSTED_DOC_ID) return;

        ndd::idInt longest_doc = longest->current_doc_id;

        ndd::idInt others_min_doc_id = EXHAUSTED_DOC_ID;
        for (size_t i = 1; i < iters.size(); i++) {
            if (iters[i]->current_doc_id < others_min_doc_id) {
                others_min_doc_id = iters[i]->current_doc_id;
            }
        }

        if (others_min_doc_id <= longest_doc) return;

        float max_possible = longest->upperBound();

        if (max_possible <= min_score) {
#ifdef NDD_INV_IDX_PRUNE_DEBUG
            uint32_t remaining_before_prune = longest->remaining_entries;
#endif
            if (others_min_doc_id == EXHAUSTED_DOC_ID) {
                longest->current_doc_id = EXHAUSTED_DOC_ID;
                longest->remaining_entries = 0;
            } else {
                longest->advance(others_min_doc_id);
            }
#ifdef NDD_INV_IDX_PRUNE_DEBUG
            if (remaining_before_prune > longest->remaining_entries) {
                longest->pruned_entries +=
                    (remaining_before_prune - longest->remaining_entries);
            }
#endif
        }
    }

    // =========================================================================
    // PostingListIterator methods
    // =========================================================================

    void InvertedIndex::PostingListIterator::init(MDBX_cursor* cursor_in,
                                                uint32_t tid,
                                                float tw,
                                                float gmax,
                                                uint32_t total_entries,
                                                const InvertedIndex* idx) {
        cursor = cursor_in;
        term_id = tid;
        term_weight = tw;
        global_max = gmax;
        index = idx;

        current_block_nr = 0;
        doc_offsets = nullptr;
        values_ptr = nullptr;
        data_size = 0;
        value_bits = 0;
        max_value = 0.0f;

        current_entry_idx = 0;
        current_doc_id = EXHAUSTED_DOC_ID;
        remaining_entries = total_entries;
#ifdef NDD_INV_IDX_PRUNE_DEBUG
        initial_entries = total_entries;
        pruned_entries = 0;
#endif

        if (!loadFirstBlock()) {
            current_doc_id = EXHAUSTED_DOC_ID;
            remaining_entries = 0;
            return;
        }

        current_entry_idx = 0;
        advanceToNextLive();
    }

    bool InvertedIndex::PostingListIterator::parseCurrentKV(const MDBX_val& key,
                                                            const MDBX_val& data) {
#ifdef ND_DEBUG
        ParseCurrentKVTimer parse_timer;
#endif
        if (key.iov_len != sizeof(uint64_t)) {
            return false;
        }

        uint64_t packed_key;
        std::memcpy(&packed_key, key.iov_base, sizeof(uint64_t));
        uint32_t key_term = unpackTermId(packed_key);
        uint32_t block_nr = unpackBlockNr(packed_key);

        if (key_term != term_id || block_nr == kMetadataBlockNr) {
            return false;
        }

        BlockView view;
        if (!index->parseBlockViewFromValue(data, block_nr, &view)) {
            return false;
        }

        current_block_nr = block_nr;
        doc_offsets = view.doc_offsets;
        values_ptr = view.values;
        data_size = view.count;
        value_bits = view.value_bits;
        max_value = view.max_value;
        current_entry_idx = 0;

        return true;
    }

    bool InvertedIndex::PostingListIterator::loadFirstBlock() {
        uint64_t seek_packed = packPostingKey(term_id, 0);
        MDBX_val key{&seek_packed, sizeof(seek_packed)};
        MDBX_val data;

        int rc = mdbx_cursor_get(cursor, &key, &data, MDBX_SET_RANGE);
        while (rc == MDBX_SUCCESS) {
            if (key.iov_len != sizeof(uint64_t)) return false;

            uint64_t packed_key;
            std::memcpy(&packed_key, key.iov_base, sizeof(uint64_t));
            uint32_t key_term = unpackTermId(packed_key);
            uint32_t block_nr = unpackBlockNr(packed_key);

            if (key_term != term_id || block_nr == kMetadataBlockNr) {
                return false;
            }

            if (!parseCurrentKV(key, data)) {
                return false;
            }

            if (data_size == 0) {
                rc = mdbx_cursor_get(cursor, &key, &data, MDBX_NEXT);
                continue;
            }

            return true;
        }

        return false;
    }

    bool InvertedIndex::PostingListIterator::loadNextBlock() {
        // LOG_TIME("loadNextBlock"); this function is not slow
        MDBX_val key;
        MDBX_val data;
        int rc = mdbx_cursor_get(cursor, &key, &data, MDBX_NEXT);

        while (rc == MDBX_SUCCESS) {
            if (key.iov_len != sizeof(uint64_t)) {
                current_doc_id = EXHAUSTED_DOC_ID;
                data_size = 0;
                return false;
            }

            uint64_t packed_key;
            std::memcpy(&packed_key, key.iov_base, sizeof(uint64_t));
            uint32_t key_term = unpackTermId(packed_key);
            uint32_t block_nr = unpackBlockNr(packed_key);

            if (key_term != term_id || block_nr == kMetadataBlockNr) {
                current_doc_id = EXHAUSTED_DOC_ID;
                data_size = 0;
                return false;
            }

            if (!parseCurrentKV(key, data)) {
                current_doc_id = EXHAUSTED_DOC_ID;
                data_size = 0;
                return false;
            }

            if (data_size == 0) {
                rc = mdbx_cursor_get(cursor, &key, &data, MDBX_NEXT);
                continue;
            }

            return true;
        }

        current_doc_id = EXHAUSTED_DOC_ID;
        data_size = 0;
        return false;
    }

    void InvertedIndex::PostingListIterator::advanceToNextLive() {
        // LOG_TIME("advanceToNextLive"); //this function is also not slow
        while (true) {
            if (value_bits == 32) {
                const float* vals = (const float*)values_ptr;
                while (current_entry_idx < data_size && vals[current_entry_idx] <= 0.0f) {
                    consumeEntries(1);
                    current_entry_idx++;
                }
            } else {
                uint32_t next_live = static_cast<uint32_t>(index->findNextLiveSIMD(
                    (const uint8_t*)values_ptr,
                    data_size,
                    current_entry_idx));
                consumeEntries(next_live - current_entry_idx);
                current_entry_idx = next_live;
            }

            if (current_entry_idx < data_size) {
                current_doc_id = docIdAt(current_entry_idx);
                return;
            }

            if (!loadNextBlock()) {
                current_doc_id = EXHAUSTED_DOC_ID;
                return;
            }

            current_entry_idx = 0;
        }
    }

    void InvertedIndex::PostingListIterator::next() {
        if (current_doc_id == EXHAUSTED_DOC_ID) return;
        consumeEntries(1);
        current_entry_idx++;
        advanceToNextLive();
    }

    void InvertedIndex::PostingListIterator::advance(ndd::idInt target_doc_id) {
        if (current_doc_id == EXHAUSTED_DOC_ID || current_doc_id >= target_doc_id) {
            return;
        }

        while (true) {
            if (current_doc_id == EXHAUSTED_DOC_ID) return;

            const uint32_t target_block_nr = docToBlockNr(target_doc_id);
            if (current_block_nr < target_block_nr) {
                consumeEntries(data_size - current_entry_idx);
                if (!loadNextBlock()) {
                    current_doc_id = EXHAUSTED_DOC_ID;
                    break;
                }
                current_entry_idx = 0;
                continue;
            }

            if (current_block_nr > target_block_nr) {
                current_entry_idx = 0;
                advanceToNextLive();
                break;
            }

            const BlockOffset target_offset = docToBlockOffset(target_doc_id);
            const BlockOffset* begin = doc_offsets + current_entry_idx;
            const BlockOffset* end = doc_offsets + data_size;
            const BlockOffset* next =
                    std::lower_bound(begin, end, target_offset);
            uint32_t next_idx = static_cast<uint32_t>(next - doc_offsets);

            consumeEntries(next_idx - current_entry_idx);
            current_entry_idx = next_idx;
            advanceToNextLive();
            break;
        }
    }

}  // namespace ndd
