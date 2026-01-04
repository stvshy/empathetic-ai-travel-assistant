FROM python:3.10-slim

WORKDIR /app

# Instalacja ffmpeg i gita
RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Zwiększony timeout dla dużych paczek
RUN pip install --no-cache-dir --retries 5 --default-timeout=1000 -r requirements.txt

COPY . .

CMD ["flask", "run", "--host=0.0.0.0"]