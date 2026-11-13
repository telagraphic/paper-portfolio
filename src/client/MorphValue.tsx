import { TextMorph } from "torph/react";

export function MorphValue({ children }: { children: string }) {
  return (
    <TextMorph duration={420} ease="cubic-bezier(0.22, 1, 0.36, 1)">
      {children}
    </TextMorph>
  );
}
