/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "production"
            ? "https://your-backend.onrender.com/api/:path*"
            : "http://localhost:5000/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
