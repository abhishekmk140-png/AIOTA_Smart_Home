/*
  AIOTA ESP32-S3 Relay 6CH Enhanced Production-Ready Firmware
  Board: Waveshare ESP32-S3-Relay-6CH
  Relay GPIOs: 1, 2, 41, 42, 45, 46.
  Sensors:
    - I2C AM2315C (Temp/Humidity) at address 0x38 (SDA: GPIO 8, SCL: GPIO 9)
    - PIR Motion Sensor (Digital Input: GPIO 4)
    - Air Quality / Gas Sensor (ADC Input: GPIO 5)
  Communication:
    - HTTP REST Server (POST /api/relay, GET /api/status, GET /health)
    - HTTP Heartbeat / Telemetry (POST to backend API /api/telemetry)
    - MQTT Subscriber & Publisher (PubSubClient)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "driver/gpio.h"

// Wi-Fi Configuration
const char* WIFI_SSID = "Airtel_AIOTA.tech";
const char* WIFI_PASSWORD = "Aiota.7372";

// Node Identity (set uniquely for each board: aiota-living, aiota-bedroom, aiota-kitchen)
const char* NODE_ID = "aiota-living";

// AIOTA Backend API & MQTT Configuration
// Set to this laptop's Wi-Fi IP address on port 8000
const char* API_BASE = "http://192.168.1.10:8000";

// AIOTA MQTT Cloud Broker Configuration
const bool MQTT_ENABLED = true;
const char* MQTT_HOST = "mqtt.aiota.tech";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "dev_baa26b76b453";
const char* MQTT_USERNAME = "dev_baa26b76b453";
const char* MQTT_PASSWORD = "GMfOR6mtO_yR3tE57G7kspk0bpyqlAuk";

// MQTT Topics
const char* MQTT_TOPIC_TELEMETRY = "devices/dev_baa26b76b453/telemetry";
const char* MQTT_TOPIC_STATUS = "devices/dev_baa26b76b453/status";
const char* MQTT_TOPIC_COMMAND = "devices/dev_baa26b76b453/cmd";

// Hardware Pin Configuration
const uint8_t RELAY_PINS[6] = {1, 2, 41, 42, 45, 46};
const uint8_t PIR_PIN = 4;
const uint8_t AIR_QUALITY_PIN = 5;
const uint8_t I2C_SDA_PIN = 8;
const uint8_t I2C_SCL_PIN = 9;

// Relay & Sensor Active Levels
const bool RELAY_ACTIVE_HIGH = true;
// Set to true for standard PIR (HIGH = motion). Set to false for Active-LOW / NC sensors.
const bool PIR_ACTIVE_HIGH = true;

bool relayState[6] = {false, false, false, false, false, false};
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
WebServer localServer(80);
unsigned long lastHeartbeat = 0;
bool sensorDetected = false;

int relayLevel(bool on) {
  return (RELAY_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH));
}

void setRelay(uint8_t channel, bool on) {
  if (channel < 1 || channel > 6) return;
  uint8_t index = channel - 1;
  relayState[index] = on;
  digitalWrite(RELAY_PINS[index], relayLevel(on));
  Serial.printf("[RELAY] CH%u -> %s\n", channel, on ? "ON" : "OFF");
}

// Enhanced AM2315C / AHT20 / AHT21 I2C Driver with Calibration & Busy Checking
bool initAM2315C() {
  const uint8_t AM2315C_ADDR = 0x38;
  delay(100);
  Wire.beginTransmission(AM2315C_ADDR);
  Wire.write(0x71); // Query status word
  if (Wire.endTransmission() != 0) return false;
  
  Wire.requestFrom(AM2315C_ADDR, (uint8_t)1);
  if (Wire.available() < 1) return false;
  uint8_t status = Wire.read();
  
  // If not calibrated (bit 3 == 0), send calibration initialization command
  if ((status & 0x08) == 0) {
    Wire.beginTransmission(AM2315C_ADDR);
    Wire.write(0xBE);
    Wire.write(0x08);
    Wire.write(0x00);
    Wire.endTransmission();
    delay(20);
  }
  return true;
}

bool readAM2315C(float &temp, float &hum) {
  const uint8_t AM2315C_ADDR = 0x38;
  
  // Trigger measurement command
  Wire.beginTransmission(AM2315C_ADDR);
  Wire.write(0xAC);
  Wire.write(0x33);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;

  // Wait for measurement & poll busy bit (bit 7 == 0 when ready)
  delay(80);
  bool ready = false;
  for (int i = 0; i < 10; i++) {
    Wire.requestFrom(AM2315C_ADDR, (uint8_t)1);
    if (Wire.available()) {
      uint8_t status = Wire.read();
      if ((status & 0x80) == 0) { // Not busy
        ready = true;
        break;
      }
    }
    delay(10);
  }
  if (!ready) return false;

  // Read full 6 data bytes
  Wire.requestFrom(AM2315C_ADDR, (uint8_t)6);
  if (Wire.available() < 6) return false;

  uint8_t state = Wire.read();
  (void)state;
  uint32_t rawHum = Wire.read();
  rawHum <<= 8;
  rawHum |= Wire.read();
  rawHum <<= 4;
  uint8_t mid = Wire.read();
  rawHum |= (mid >> 4);

  uint32_t rawTemp = (mid & 0x0F);
  rawTemp <<= 8;
  rawTemp |= Wire.read();
  rawTemp <<= 8;
  rawTemp |= Wire.read();

  float calculatedHum = ((float)rawHum * 100.0) / 1048576.0;
  float calculatedTemp = (((float)rawTemp * 200.0) / 1048576.0) - 50.0;

  // Sanity check: discard obviously corrupted data packets
  if (calculatedHum <= 0.0 || calculatedHum > 100.0 || calculatedTemp < -40.0 || calculatedTemp > 85.0) {
    return false;
  }

  hum = constrain(calculatedHum, 5.0, 99.0);
  temp = calculatedTemp;
  return true;
}

void publishState() {
  if (!MQTT_ENABLED || !mqtt.connected()) return;
  StaticJsonDocument<256> doc;
  doc["device_id"] = MQTT_CLIENT_ID;
  doc["node_id"] = NODE_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  JsonArray states = doc.createNestedArray("relays");
  for (int i = 0; i < 6; i++) states.add(relayState[i]);
  char payload[256];
  serializeJson(doc, payload);
  mqtt.publish(MQTT_TOPIC_STATUS, payload, true);
  Serial.printf("[MQTT] Status published to %s: %s\n", MQTT_TOPIC_STATUS, payload);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[MQTT] JSON parse error: %s\n", err.c_str());
    return;
  }
  
  int channel = doc["channel"] | 0;
  bool isOn = false;
  if (doc.containsKey("is_on")) {
    isOn = doc["is_on"].as<bool>();
  } else if (doc.containsKey("state")) {
    const char* st = doc["state"];
    isOn = (String(st).equalsIgnoreCase("ON") || String(st) == "1" || String(st).equalsIgnoreCase("true"));
  } else if (doc.containsKey("value")) {
    isOn = doc["value"].as<int>() > 0;
  }

  bool isAll = (channel == 0 || (doc.containsKey("all") && doc["all"].as<bool>()));
  if (isAll) {
    for (int i = 1; i <= 6; i++) {
      setRelay(i, isOn);
    }
    publishState();
    Serial.printf("[MQTT] ALL 6 Relays updated via MQTT: -> %s\n", isOn ? "ON" : "OFF");
    return;
  }

  if (channel >= 1 && channel <= 6) {
    setRelay(channel, isOn);
    publishState();
    Serial.printf("[MQTT] Relays updated via MQTT: CH%d -> %s\n", channel, isOn ? "ON" : "OFF");
  }
}

void connectMqtt() {
  if (!MQTT_ENABLED || mqtt.connected() || WiFi.status() != WL_CONNECTED) return;
  Serial.printf("[MQTT] Connecting to %s as %s...\n", MQTT_HOST, MQTT_CLIENT_ID);
  if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println("[MQTT] Connected to AIOTA MQTT Broker!");
    mqtt.subscribe(MQTT_TOPIC_COMMAND);
    Serial.printf("[MQTT] Subscribed to command topic: %s\n", MQTT_TOPIC_COMMAND);
    publishState();
  } else {
    Serial.printf("[MQTT] Connection failed, rc=%d. Will retry.\n", mqtt.state());
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(API_BASE) + "/api/telemetry");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(350); // Ultra-low 350ms timeout so telemetry never blocks relay switching

  float temp = 0.0, hum = 0.0;
  bool hasSensor = readAM2315C(temp, hum);

  // Robust debounced PIR sampling (5 samples across 2ms)
  int pirHighCount = 0;
  for (int s = 0; s < 5; s++) {
    if (digitalRead(PIR_PIN) == HIGH) pirHighCount++;
    delayMicroseconds(500);
  }
  bool rawPinLevel = (pirHighCount >= 4);
  bool motion = (PIR_ACTIVE_HIGH ? rawPinLevel : !rawPinLevel);

  // 30-second initial stabilization guard after boot
  if (millis() < 30000) {
    motion = false;
  }
  Serial.printf("[PIR] GPIO%u (H1 Pin 15) Raw: %d | Filtered Motion: %s\n", PIR_PIN, rawPinLevel ? 1 : 0, motion ? "OCCUPIED" : "CLEAR");

  int rawAir = analogRead(AIR_QUALITY_PIN);
  float airAqi = map(rawAir, 0, 4095, 10, 200);

  StaticJsonDocument<256> doc;
  doc["node_id"] = NODE_ID;
  if (hasSensor) {
    doc["temperature"] = round(temp * 10.0) / 10.0;
    doc["humidity"] = round(hum * 10.0) / 10.0;
  } else {
    doc["temperature"] = nullptr;
    doc["humidity"] = nullptr;
  }
  doc["air_quality"] = airAqi;
  doc["motion"] = motion;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  Serial.printf("[TELEMETRY] Sent to %s: HTTP status %d\n", API_BASE, code);
  http.end();

  // Also publish telemetry directly to AIOTA MQTT Broker
  if (MQTT_ENABLED && mqtt.connected()) {
    char telePayload[256];
    serializeJson(doc, telePayload);
    mqtt.publish(MQTT_TOPIC_TELEMETRY, telePayload);
    Serial.printf("[MQTT] Telemetry published to %s: %s\n", MQTT_TOPIC_TELEMETRY, telePayload);
  }
}

void handleHttpRelay() {
  localServer.sendHeader("Access-Control-Allow-Origin", "*");
  localServer.sendHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  localServer.sendHeader("Access-Control-Allow-Headers", "*");

  if (!localServer.hasArg("plain")) {
    localServer.send(400, "application/json", "{\"error\":\"missing JSON body\"}");
    return;
  }
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, localServer.arg("plain"))) {
    localServer.send(400, "application/json", "{\"error\":\"invalid JSON\"}");
    return;
  }
  int channel = doc["channel"] | 0;
  bool isAll = (channel == 0 || (doc.containsKey("all") && doc["all"].as<bool>()));
  bool isOn = doc["is_on"] | false;

  if (isAll) {
    for (int i = 1; i <= 6; i++) {
      setRelay(i, isOn);
    }
    localServer.send(200, "application/json", "{\"ok\":true,\"all\":true}");
    Serial.printf("[HTTP] ALL 6 Relays switched to %s\n", isOn ? "ON" : "OFF");
    publishState();
    return;
  }

  if (channel < 1 || channel > 6) {
    localServer.send(400, "application/json", "{\"error\":\"channel must be 1..6\"}");
    return;
  }
  setRelay(channel, isOn);
  localServer.send(200, "application/json", "{\"ok\":true}");
  Serial.printf("[HTTP] Relays updated: CH%d set to %s\n", channel, isOn ? "ON" : "OFF");
  publishState();
}

void handleHttpStatus() {
  localServer.sendHeader("Access-Control-Allow-Origin", "*");
  StaticJsonDocument<384> doc;
  doc["node_id"] = NODE_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();

  // Instant debounced PIR sampling (5 samples across 2ms)
  int pirHigh = 0;
  for (int s = 0; s < 5; s++) {
    if (digitalRead(PIR_PIN) == HIGH) pirHigh++;
    delayMicroseconds(500);
  }
  bool rawPinLevel = (pirHigh >= 4);
  bool motion = (PIR_ACTIVE_HIGH ? rawPinLevel : !rawPinLevel);
  if (millis() < 30000) motion = false;

  doc["motion"] = motion;
  doc["pir_raw"] = rawPinLevel ? 1 : 0;
  doc["pir_pin"] = PIR_PIN;

  JsonArray relays = doc.createNestedArray("relays");
  for (int i = 0; i < 6; i++) relays.add(relayState[i]);
  String out;
  serializeJson(doc, out);
  localServer.send(200, "application/json", out);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[AIOTA] Initializing Waveshare ESP32-S3 Relay 6CH...");

  // Relay Outputs
  for (int i = 0; i < 6; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], relayLevel(false));
  }

  // Sensor Inputs
  // Force hardware internal pull-down on PIR input (GPIO 4 is Pin 15 on Header H1)
  gpio_reset_pin((gpio_num_t)PIR_PIN);
  gpio_set_direction((gpio_num_t)PIR_PIN, GPIO_MODE_INPUT);
  gpio_pulldown_en((gpio_num_t)PIR_PIN);
  gpio_pullup_dis((gpio_num_t)PIR_PIN);

  pinMode(AIR_QUALITY_PIN, INPUT);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  initAM2315C();

  // Wi-Fi Connection
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to %s...", WIFI_SSID);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n==========================================");
    Serial.printf("[WIFI] Connected to %s!\n", WIFI_SSID);
    Serial.printf("[WIFI] ESP32 IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Backend API Target: %s\n", API_BASE);
    Serial.println("==========================================\n");
  } else {
    Serial.println("[WIFI] Connection timed out; running in offline AP/recovery fallback.");
  }

  // Web Server Routes
  localServer.on("/api/relay", HTTP_OPTIONS, []() {
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.sendHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    localServer.sendHeader("Access-Control-Allow-Headers", "*");
    localServer.send(204);
  });
  localServer.on("/api/relay", HTTP_POST, handleHttpRelay);
  localServer.on("/api/status", HTTP_GET, handleHttpStatus);
  localServer.on("/health", HTTP_GET, []() {
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.send(200, "application/json", "{\"status\":\"ok\",\"hardware\":\"Waveshare ESP32-S3 6CH\"}");
  });
  localServer.begin();
  Serial.printf("[HTTP] Local command server listening on http://%s:80\n", WiFi.localIP().toString().c_str());

  if (MQTT_ENABLED) {
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
  }
}

void loop() {
  localServer.handleClient();

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (millis() - lastWifiRetry > 6000) {
      lastWifiRetry = millis();
      Serial.println("[WIFI] Disconnected! Attempting auto-reconnect to Wi-Fi...");
      WiFi.reconnect();
    }
  } else {
    if (MQTT_ENABLED) {
      static unsigned long lastMqttRetry = 0;
      if (!mqtt.connected()) {
        if (millis() - lastMqttRetry > 5000) {
          lastMqttRetry = millis();
          connectMqtt();
        }
      } else {
        mqtt.loop();
      }
    }

    localServer.handleClient();

    // Periodic telemetry heartbeat (every 15 seconds)
    if (millis() - lastHeartbeat > 15000) {
      lastHeartbeat = millis();
      sendHeartbeat();
      publishState();
      localServer.handleClient();
    }
  }
  yield();
}
