FROM python:3.11-slim

# LibreOffice 및 한글 폰트 설치
RUN apt-get update && apt-get install -y \
    libreoffice \
    libglib2.0-0 \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저 설치 (캐시 활용)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY . .

# LibreOffice 임시 파일용 디렉터리 권한 설정
RUN mkdir -p /tmp/libreoffice && chmod 777 /tmp/libreoffice

EXPOSE 8000

# Render는 $PORT 환경 변수를 제공합니다. 이를 사용하도록 수정합니다.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
