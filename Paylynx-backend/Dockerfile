# Use a lightweight Python base image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# 1. Copy just the requirements first (Docker Layer Caching)
# This makes re-builds super fast if you only change code, not libs
COPY requirements.txt .

# 2. Install dependencies
# --no-cache-dir keeps the image small
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy the rest of your application code
COPY . .

# 4. Expose the port (Render usually uses 10000, but we use $PORT env var)
EXPOSE 10000

# 5. The Command to Run Your App
# We use '0.0.0.0' to allow external connections (Required for Render)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]