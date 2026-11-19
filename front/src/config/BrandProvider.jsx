import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getUserDataCached } from "../apis/getUserData";
import { BRAND_OVERRIDE_KEY } from "./brandIds";
import {
  applyBrandDocument,
  brandFromSearch,
  defaultBrandId,
  defaultBrandProfile,
  getBrandProfile,
  resolveBrandId,
  setCurrentBrand,
} from "./brands";

// Re-exported for callers that only need the storage key.
export { BRAND_OVERRIDE_KEY };

const BrandContext = createContext(null);

const readStoredOverride = () => {
  try {
    return sessionStorage.getItem(BRAND_OVERRIDE_KEY);
  } catch {
    return null;
  }
};

const storeOverride = (id) => {
  try {
    sessionStorage.setItem(BRAND_OVERRIDE_KEY, id);
  } catch {
    // Private mode or blocked storage: the override simply lasts one render.
  }
};

export function BrandProvider({ children }) {
  const [override, setOverride] = useState(() => {
    const fromQuery = brandFromSearch(window.location.search);
    if (fromQuery) storeOverride(fromQuery);
    return fromQuery ?? readStoredOverride();
  });
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    let active = true;
    getUserDataCached()
      .then((data) => {
        if (active) setUserData(data);
      })
      .catch(() => {
        // No profile route (a direct engine) or a failed request: keep default.
      });
    return () => {
      active = false;
    };
  }, []);

  const brandId = useMemo(
    () => resolveBrandId({ userData, override }),
    [userData, override],
  );
  const brand = useMemo(
    () => getBrandProfile(brandId) ?? defaultBrandProfile(),
    [brandId],
  );

  useEffect(() => {
    setCurrentBrand(brand);
    applyBrandDocument(brand);
  }, [brand]);

  const value = useMemo(
    () => ({
      brand,
      brandId,
      setOverride: (id) => {
        if (!id) {
          try {
            sessionStorage.removeItem(BRAND_OVERRIDE_KEY);
          } catch {
            // ignore
          }
          setOverride(null);
          return;
        }
        storeOverride(id);
        setOverride(id);
      },
    }),
    [brand, brandId],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

const fallback = () => ({
  brand: defaultBrandProfile(),
  brandId: defaultBrandId(),
  setOverride: () => {},
});

/** Safe outside the provider: returns the deployment's default brand. */
export function useBrand() {
  return useContext(BrandContext) ?? fallback();
}
