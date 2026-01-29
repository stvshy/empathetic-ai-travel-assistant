# Używamy Pythona 3.10
FROM python:3.10-slim

# Instalujemy zależności systemowe
# ffmpeg - do audio
# wget, tar - do pobrania Pipera
# git - czasem potrzebny do pip
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    tar \
    git \
    && rm -rf /var/lib/apt/lists/*

# Ustawiamy katalog roboczy
WORKDIR /app

# Kopiujemy requirements
COPY requirements.txt .

# Instalujemy biblioteki Python (bez cache, żeby oszczędzić miejsce)
RUN pip install --no-cache-dir -r requirements.txt

# --- INSTALACJA PIPERA (Wersja Linux) ---
# Pobieramy binarkę Pipera dla Linuxa (amd64)
# To jest kluczowe, bo Twój lokalny plik .exe nie zadziała
RUN wget -O piper.tar.gz https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_amd64.tar.gz \
    && tar -xf piper.tar.gz \
    && rm piper.tar.gz
# Piper wypakuje się do folderu /app/piper

# Kopiujemy resztę plików aplikacji
COPY . .

# Hugging Face wymaga, by aplikacja działała jako użytkownik 1000, nie root
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Otwieramy port 7860 (standard HF)
EXPOSE 7860

# Uruchamiamy aplikację
CMD ["python", "app.py"]