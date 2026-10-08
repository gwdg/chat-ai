import { useEffect, useState } from "react";
import { Trans } from "react-i18next";

const userDataEndpoint = import.meta.env.VITE_USERDATA_ENDPOINT;

// Asks the user endpoint before rendering the app, and shows a "no access"
// page instead when the back end rejects this user (401/403).
export default function AccessGate({ children }) {
  const [status, setStatus] = useState(userDataEndpoint ? null : 200);

  useEffect(() => {
    if (!userDataEndpoint) return;
    fetch(userDataEndpoint)
      .then((response) => setStatus(response.status))
      .catch(() => setStatus(0)); // Network errors are not a rejection
  }, []);

  if (status === null) return null;

  if (status === 401 || status === 403) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4 text-center">
        <p className="text-4xl font-bold mb-4">
          <Trans i18nKey="no_access.title" />
        </p>
        <p className="text-lg text-gray-600">
          <Trans i18nKey="no_access.description" />
        </p>
      </div>
    );
  }

  return children;
}
