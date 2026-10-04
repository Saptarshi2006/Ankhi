import type { Metadata } from "next";
import FunGame from "@/components/fun/FunGame";
import SoundToggle from "@/components/SoundToggle";

/**
 * The fun page.
 *
 * Its own `metadata` rather than inheriting the root one, so the tab says where
 * the reader actually is and a shared link does not claim to be the letter.
 */
export const metadata: Metadata = {
  title: "Seven, Ankhi",
  description: "Seven things, behind seven targets.",
};

export default function FunPage() {
  return (
    <>
      {/*
        The sound toggle rather than the music. The score is a timeline thing —
        it is driven by beat entry and hands over between tracks — and none of
        that machinery means anything here. What this page makes noise with is a
        single synthesised rustle on a hit, and it still has to be muteable.
      */}
      <SoundToggle />
      <FunGame />
    </>
  );
}
