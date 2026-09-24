# AgriLog v2 API — ảnh production.
#
# Build từ thư mục GỐC của repo, không phải từ backend/, vì API đọc dữ liệu
# tĩnh (quy trình chăm sóc, danh mục giống, bảng giá phân) trong shared/data:
#
#   docker build -f backend/Dockerfile -t agrilog-api .
#   docker run -p 8000:8000 -v agrilog-media:/data/media --env-file backend/.env.production agrilog-api

FROM python:3.12-slim

# Không ghi .pyc, không đệm stdout (log hiện ngay trong docker logs).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Cài phụ thuộc trước, chép mã nguồn sau: đổi một dòng code không phải cài lại
# toàn bộ thư viện.
COPY backend/requirements.txt backend/requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY backend/app ./app
COPY backend/scripts ./scripts
# Dữ liệu tĩnh dùng chung với app điện thoại — app/core/config.py trỏ tới đây.
COPY shared/data /shared/data
# Font Unicode cho báo cáo PDF tiếng Việt (app/services/report_pdf.py).
COPY mobile/src/assets/fonts /mobile/src/assets/fonts

# Chạy bằng tài khoản thường, không phải root. /data/media (ảnh/video nông hộ)
# được tạo sẵn và thuộc về tài khoản đó: một volume gắn vào thư mục chưa có
# trong ảnh sẽ thuộc root, và API không ghi được tệp nào.
RUN useradd --create-home --uid 1000 agrilog \
    && mkdir -p /data/media \
    && chown -R agrilog:agrilog /app /shared /mobile /data
ENV MEDIA_DIR=/data/media
# Gắn volume ở đây (docker run -v agrilog-media:/data/media), nếu không ảnh mất
# theo container ở lần triển khai kế tiếp.
VOLUME ["/data/media"]
USER agrilog

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else 1)"

# 4 tiến trình: một tiến trình Python chỉ dùng được một lõi, và đo thực tế cho
# thấy một worker phục vụ tốt khoảng 50 nông hộ đồng thời dưới 1 giây
# (docs/BACKEND_DEPLOYMENT.md). Chỉnh -w theo số lõi của máy chủ, và nhớ giữ
# SỐ_WORKER × (DB_POOL_SIZE + DB_MAX_OVERFLOW) < max_connections của PostgreSQL.
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "4", \
     "-b", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--timeout", "60"]
