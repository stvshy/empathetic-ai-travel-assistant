FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --default-timeout=120 -r requirements.txt

COPY . .

CMD ["flask", "run", "--host=0.0.0.0"]
