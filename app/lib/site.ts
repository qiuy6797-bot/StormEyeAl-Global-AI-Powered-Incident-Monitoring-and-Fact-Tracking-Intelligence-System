const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const siteBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`
  : "";

export const feedSnapshotPath = `${siteBasePath}/data/feeds.json`;
