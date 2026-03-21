"use client";

import Masonry, { MasonryProps } from "react-masonry-css";

interface ExtendedMasonryProps extends MasonryProps {
    children?: React.ReactNode;
}

export default function MasonryLayout(props: ExtendedMasonryProps) {
    return <Masonry {...props} />;
}
