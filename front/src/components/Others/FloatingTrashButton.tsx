import { TrashCan } from "@carbon/icons-react";

import Tooltip from "./Tooltip";

/**
 * The delete control a master page floats over its top-right corner, exactly where
 * a chat floats its Close Chat button: a circle of its own, no band to sit in.
 */
type FloatingTrashButtonProps = {
  label: string;
  onClick: () => void;
  testId: string;
};

export default function FloatingTrashButton({
  label,
  onClick,
  testId,
}: FloatingTrashButtonProps) {
  return (
    <Tooltip text={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        data-testid={testId}
        data-guide={testId}
        className="btn btn-circle shadow-lg"
      >
        <TrashCan
          size={20}
          className="cursor-pointer text-base-content/70 transition-colors hover:text-error"
        />
      </button>
    </Tooltip>
  );
}
