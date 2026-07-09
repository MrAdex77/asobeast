"use client";

import { KeywordsTable } from "./KeywordsTable";

export function KeywordsWorkspace({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-6">
      <KeywordsTable id={id} />
    </div>
  );
}
