const basePath = process.env.COMMAND_CENTER_BASE_PATH || "";

const nextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_COMMAND_CENTER_BASE_PATH: basePath,
  },
};

export default nextConfig;
