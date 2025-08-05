# Build image expects your static site already in ./dist (from `npm run build`)
FROM nginx:1.27-alpine

# Drop default server, add ours
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf                  /etc/nginx/nginx.conf
COPY nginx/site-prod.conf              /etc/nginx/conf.d/site-prod.conf
# Optional: staging config (see below)
# COPY nginx/site-staging.conf        /etc/nginx/conf.d/site-staging.conf

# Static files
COPY dist/ /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/health || exit 1
