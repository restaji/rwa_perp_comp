/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|logos|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
