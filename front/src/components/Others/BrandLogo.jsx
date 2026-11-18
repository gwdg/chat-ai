import { useBrand } from "../../config/BrandProvider";
import { withBase } from "../../config/brands";

/**
 * Renders the active brand's image. `variant` is one of `full`, `small` or
 * `mark`. A brand may provide a `*Dark` counterpart; both are rendered and CSS
 * decides, so switching dark mode needs no re-render.
 */
export default function BrandLogo({
  variant = "full",
  className = "",
  alt,
  ...rest
}) {
  const { brand } = useBrand();
  const assets = brand.assets ?? {};
  const light = assets[variant] ?? assets.full;
  const dark = assets[`${variant}Dark`];
  const label = alt ?? brand.logo?.alt ?? brand.name;

  if (!light) return null;

  if (!dark) {
    return (
      <img
        src={withBase(light)}
        alt={label}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <>
      <img
        src={withBase(light)}
        alt={label}
        className={`${className} dark:hidden`}
        {...rest}
      />
      <img
        src={withBase(dark)}
        alt={label}
        className={`${className} hidden dark:block`}
        {...rest}
      />
    </>
  );
}
