#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <functional>
#include <limits>
#include <memory>
#include <queue>
#include <shared_mutex>
#include <thread>
#include <unordered_map>
#include <vector>

#if defined(__x86_64__) || defined(_M_X64)
#    include <immintrin.h>
#elif defined(__aarch64__) || defined(_M_ARM64)
#    include <arm_neon.h>
#endif

#include "mdbx/mdbx.h"
#include "../core/types.hpp"
#include "../utils/log.hpp"
#include "../utils/settings.hpp"
#include "sparse_vector.hpp"

namespace ndd {

    static constexpr ndd::idInt EXHAUSTED_DOC_ID = std::numeric_limits<ndd::idInt>::max();

#pragma pack(push, 1)
    struct PostingListHeader {
        uint32_t nr_entries = 0;
        uint32_t nr_live_entries = 0;
        float max_value = 0.0f;
    };

    struct BlockHeader {
        uint8_t version = 1;
        uint16_t nr_entries = 0;
        uint16_t nr_live_entries = 0;
        float max_value = 0.0f;
    };
#pragma pack(pop)

    struct PostingListEntry {
        ndd::idInt doc_id;
        float value;

        PostingListEntry() : doc_id(0), value(0.0f) {}
        PostingListEntry(ndd::idInt id, float val) : doc_id(id), value(val) {}
    };

    struct ScoredDoc {
        ndd::idInt doc_id;
        float score;

        ScoredDoc(ndd::idInt id, float s) : doc_id(id), score(s) {}

        bool operator<(const ScoredDoc& other) const {
            return score > other.score;
        }
    };

    class InvertedIndex {
    public:
        InvertedIndex(MDBX_env* env, size_t vocab_size);
        ~InvertedIndex() = default;

        bool initialize();

        bool addDocumentsBatch(MDBX_txn* txn,
                                const std::vector<std::pair<ndd::idInt, SparseVector>>& docs);

        bool removeDocument(MDBX_txn* txn, ndd::idInt doc_id, const SparseVector& vec);

        size_t getTermCount() const;
        size_t getVocabSize() const;

        std::vector<std::pair<ndd::idInt, float>>search(const SparseVector& query,
                                                        size_t k,
                                                        const ndd::RoaringBitmap* filter = nullptr);

    private:
        friend class InvertedIndexTestPeer;

        MDBX_env* env_;
        MDBX_dbi blocked_term_postings_dbi_;
        size_t vocab_size_;

        std::unordered_map<uint32_t, float> term_info_;

        mutable std::shared_mutex mutex_;

        using BlockOffset = uint16_t;
        static constexpr uint32_t kBlockCapacity = std::numeric_limits<BlockOffset>::max();
        static constexpr uint8_t kOnDiskVersion = 1;

        // Sentinel IDs reserved for metadata rows in blocked_term_postings.
        static constexpr uint32_t kMetadataTermId = std::numeric_limits<uint32_t>::max();
        static constexpr uint32_t kMetadataBlockNr = std::numeric_limits<uint32_t>::max();

        static inline uint8_t quantize(float val, float max_val);
        static inline float dequantize(uint8_t val, float max_val);

        // Key packing is term_id in high 32 bits and block_nr in low 32 bits.
        // This keeps all keys for a term contiguous so range scans can seek to
        // [pack(term, 0), pack(term, UINT32_MAX)] efficiently.
        static inline uint64_t packPostingKey(uint32_t term_id, uint32_t block_nr) {
            return (static_cast<uint64_t>(term_id) << 32) | static_cast<uint64_t>(block_nr);
        }

        static inline uint32_t unpackTermId(uint64_t packed_key) {
            return static_cast<uint32_t>(packed_key >> 32);
        }

        static inline uint32_t unpackBlockNr(uint64_t packed_key) {
            return static_cast<uint32_t>(packed_key & 0xFFFFFFFFULL);
        }

        static inline uint32_t docToBlockNr(ndd::idInt doc_id) {
            return static_cast<uint32_t>(doc_id / kBlockCapacity);
        }

        static inline BlockOffset docToBlockOffset(ndd::idInt doc_id) {
            return static_cast<BlockOffset>(doc_id % kBlockCapacity);
        }

        static inline ndd::idInt blockOffsetToDocId(uint32_t block_nr, BlockOffset block_offset) {
            uint64_t base = static_cast<uint64_t>(block_nr)
                            * static_cast<uint64_t>(kBlockCapacity);
            return static_cast<ndd::idInt>(base + static_cast<uint64_t>(block_offset));
        }

        struct BlockView {
            const BlockOffset* doc_offsets;
            const void* values;
            uint32_t count;
            uint8_t value_bits;
            float max_value;
        };

        struct PostingListIterator {
            uint32_t term_id;
            float term_weight;
            float global_max;
            const InvertedIndex* index;

            MDBX_cursor* cursor;
            uint32_t current_block_nr;

            const BlockOffset* doc_offsets;
            const void* values_ptr;
            uint32_t data_size;
            uint8_t value_bits;
            float max_value;

            uint32_t current_entry_idx;
            ndd::idInt current_doc_id;

            // This is maintained incrementally from posting-list metadata,
            // so pruning can estimate list length without scanning all blocks.
            uint32_t remaining_entries;

#ifdef NDD_INV_IDX_PRUNE_DEBUG
            uint32_t initial_entries;
            uint32_t pruned_entries;
#endif

            void init(MDBX_cursor* cursor,
                    uint32_t term_id,
                    float term_weight,
                    float global_max,
                    uint32_t total_entries,
                    const InvertedIndex* index);

            inline float valueAt(uint32_t idx) const {
                if (value_bits == 32) {
                    return ((const float*)values_ptr)[idx];
                }
                return dequantize(((const uint8_t*)values_ptr)[idx], max_value);
            }

            inline bool isLiveAt(uint32_t idx) const {
                if (value_bits == 32) {
                    return ((const float*)values_ptr)[idx] > 0.0f;
                }
                return ((const uint8_t*)values_ptr)[idx] > 0;
            }

            inline float currentValue() const {
                return valueAt(current_entry_idx);
            }

            void advanceToNextLive();
            void next();
            void advance(ndd::idInt target_doc_id);

            float upperBound() const {
                return global_max * term_weight;
            }

            uint32_t remainingEntries() const {
                if (current_doc_id == EXHAUSTED_DOC_ID) return 0;
                return remaining_entries;
            }

            bool loadNextBlock();
            bool loadFirstBlock();
            bool parseCurrentKV(const MDBX_val& key, const MDBX_val& data);

            inline void consumeEntries(uint32_t count) {
                if (count >= remaining_entries) {
                    remaining_entries = 0;
                } else {
                    remaining_entries -= count;
                }
            }

            inline ndd::idInt currentBlockBaseDocId() const {
                return blockOffsetToDocId(current_block_nr, 0);
            }

            inline ndd::idInt docIdAt(uint32_t idx) const {
                return blockOffsetToDocId(current_block_nr, doc_offsets[idx]);
            }

        private:
            static inline float dequantize(uint8_t val, float max_val) {
                if (max_val <= settings::NEAR_ZERO) return 0.0f;
                return (float)val * (max_val / UINT8_MAX);
            }
        };

        size_t findDocIdSIMD(const uint32_t* doc_ids,
                                size_t size,
                                size_t start_idx,
                                uint32_t target) const;

        size_t findNextLiveSIMD(const uint8_t* values,
                                size_t size,
                                size_t start_idx) const;

        PostingListHeader readPostingListHeader(MDBX_txn* txn,
                                                uint32_t term_id,
                                                bool* out_found = nullptr) const;

        bool writePostingListHeader(MDBX_txn* txn,
                                    uint32_t term_id,
                                    const PostingListHeader& header);

        bool deletePostingListHeader(MDBX_txn* txn, uint32_t term_id);

        bool loadBlockEntries(MDBX_txn* txn,
                            uint32_t term_id,
                            uint32_t block_nr,
                            std::vector<PostingListEntry>* entries,
                            uint32_t* out_live_count,
                            float* out_max_value,
                            bool* out_found) const;

        bool saveBlockEntries(MDBX_txn* txn,
                            uint32_t term_id,
                            uint32_t block_nr,
                            const std::vector<PostingListEntry>& entries,
                            uint32_t live_count,
                            float max_val);

        bool deleteBlock(MDBX_txn* txn, uint32_t term_id, uint32_t block_nr);

        bool parseBlockViewFromValue(const MDBX_val& data,
                                    uint32_t block_nr,
                                    BlockView* out_view) const;

        bool iterateTermBlocks(
            MDBX_txn* txn,
            uint32_t term_id,
            const std::function<bool(uint32_t block_nr, const MDBX_val& data)>& callback) const;

        float recomputeGlobalMaxFromBlocks(MDBX_txn* txn, uint32_t term_id) const;

        bool deleteAllBlocksForTerm(MDBX_txn* txn, uint32_t term_id);

        bool loadTermInfo();

        bool addDocumentsBatchInternal(
            MDBX_txn* txn,
            const std::vector<std::pair<ndd::idInt, SparseVector>>& docs);

        bool removeDocumentInternal(MDBX_txn* txn,
                                    ndd::idInt doc_id,
                                    const SparseVector& vec);

        void pruneLongest(std::vector<PostingListIterator*>& iters, float min_score);
    };

    void printSparseSearchDebugStats();
    void printSparseUpdateDebugStats();

}  // namespace ndd
