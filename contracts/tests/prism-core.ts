import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

// Tests implemented Day 3-5. See 09-lld-completion.md §9.6 for full test enumeration.

describe("prism-core", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("placeholder — tests implemented Day 3", async () => {
    expect(true).to.be.true;
  });
});
