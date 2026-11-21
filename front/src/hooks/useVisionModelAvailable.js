import { useEffect, useState } from "react";

import { isVisionModelAvailable } from "../apis/visionModel";

/**
 * `true` when the deployment lists the vision model `explainImage` uses, `false`
 * when it does not, `null` while the model list is still being read. The image
 * preview keeps its Describe button greyed out until this answers `true`.
 */
export function useVisionModelAvailable() {
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    let cancelled = false;
    isVisionModelAvailable()
      .then((value) => {
        if (!cancelled) setAvailable(value === true);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
