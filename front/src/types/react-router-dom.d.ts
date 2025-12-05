// Minimal fallback types for editors when @types are unavailable.
declare module "react-router-dom" {
  export const Link: any;
  export const Navigate: any;
  export const Outlet: any;
  export function useNavigate(): any;
  export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T;
  export function useLocation(): any;
  export function useSearchParams(): [URLSearchParams, (nextInit?: any) => void];
}
