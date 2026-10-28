# Multi-stage build for ReSlot Spring Boot Backend
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B

# Minimal runtime image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S reslot && adduser -S reslot -G reslot
USER reslot:reslot

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
