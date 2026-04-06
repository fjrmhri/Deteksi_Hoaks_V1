FROM python:3.11-slim

# Non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Set workdir
WORKDIR /app

# Copy requirements dan install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua kode
COPY . .

# Env default (bisa dioverride di runtime)
ENV HOST=0.0.0.0
ENV PORT=7860

# Expose port
EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]