import { Link } from "react-router-dom";
import BrandLogo from "../Others/BrandLogo";
import { useBrand } from "../../config/BrandProvider";

export default function LogoContainer({ isMobile = false }) {
  const { brand } = useBrand();
  const target = brand.homeUrl || "https://chat-ai.academiccloud.de/";
  const external = /^https?:/i.test(target);

  const headerVariant = brand.logo?.headerVariant ?? "full";
  const content = !isMobile ? (
    <div className="flex items-center">
      <BrandLogo
        variant={headerVariant}
        className="h-8 w-auto max-w-[180px] object-contain"
        alt={brand.logo?.alt || brand.name}
      />
    </div>
  ) : (
    <div className="flex-shrink-0">
      <BrandLogo
        className="h-6 min-[400px]:h-7 min-[500px]:h-8 w-auto object-contain"
        alt={brand.logo?.alt || brand.name}
      />
    </div>
  );

  return external ? (
    <a href={target} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <Link to={target}>{content}</Link>
  );
}
