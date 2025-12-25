FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

ARG APP_SUBDIR=app/public/2lab/python
ARG UVICORN_PORT=8000

COPY ./${APP_SUBDIR}/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

COPY ./${APP_SUBDIR}/ ./

EXPOSE ${UVICORN_PORT}

CMD ["sh", "-c", "uvicorn main:app --host=0.0.0.0 --port=${UVICORN_PORT}"]
