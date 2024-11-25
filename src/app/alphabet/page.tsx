import { AlphabetConverter } from "@/components/alphabet/alphabet-converter";
import Article from "@/components/common/json-ld-component";

export default function Alphabet() {
  return (
    <>
      <Article index={2} />
      <AlphabetConverter />
    </>
  );
}
