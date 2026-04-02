FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# stdin/stdout transport — no HTTP port needed
CMD ["python", "bot.py"]
