import type { Group, Meta } from "./types.ts";

/** The groups, in the order the library shows them. */
export const GROUPS: readonly Group[] = ["substation", "control", "plant", "ev", "metering", "iot", "security"];

/** Every protocol, in the library's order. Each one has a lesson folder of the same id. */
export const CATALOG: readonly Meta[] = [
    { id: "iec-61850-mms", name: "IEC 61850 MMS", group: "substation", devices: ["relay", "controller", "inverter"], wire: "TCP 102 · TLS 3782" },
    { id: "iec-61850-goose", name: "IEC 61850 GOOSE", group: "substation", devices: ["relay", "controller"], wire: "Ethernet · 0x88B8" },
    { id: "iec-61850-sv", name: "IEC 61850 Sampled Values", group: "substation", devices: ["merging-unit", "relay"], wire: "Ethernet · 0x88BA" },
    { id: "iec-103", name: "IEC 60870-5-103", group: "substation", devices: ["relay"], wire: "Serial · FT 1.2" },
    { id: "prp-hsr", name: "PRP / HSR", group: "substation", devices: ["switch", "relay"], wire: "Ethernet · IEC 62439-3" },
    { id: "ptp", name: "PTP power profile", group: "substation", devices: ["clock", "merging-unit", "relay"], wire: "Ethernet · 0x88F7" },
    { id: "r-goose", name: "R-GOOSE / R-SV", group: "substation", devices: ["relay"], wire: "UDP 102" },
    { id: "irig-b", name: "IRIG-B", group: "substation", devices: ["clock", "relay"], wire: "Coax · twisted pair" },
    { id: "ntp", name: "NTP / SNTP", group: "substation", devices: ["clock", "rtu", "scada"], wire: "UDP 123" },

    { id: "iec-104", name: "IEC 60870-5-104", group: "control", devices: ["rtu", "scada", "gateway"], wire: "TCP 2404 · TLS 19998" },
    { id: "iec-101", name: "IEC 60870-5-101", group: "control", devices: ["rtu", "scada", "radio"], wire: "Serial · FT 1.2" },
    { id: "dnp3", name: "DNP3", group: "control", devices: ["rtu", "scada"], wire: "TCP/UDP 20000 · serial" },
    { id: "iccp", name: "ICCP / TASE.2", group: "control", devices: ["scada"], wire: "TCP 102" },
    { id: "c37-118", name: "IEEE C37.118", group: "control", devices: ["pmu", "scada"], wire: "TCP 4712 · UDP 4713" },
    { id: "cim-cgmes", name: "CIM / CGMES", group: "control", devices: ["scada", "cloud"], wire: "RDF/XML files · IEC 61970" },

    { id: "modbus-tcp", name: "Modbus TCP", group: "plant", devices: ["inverter", "meter", "battery", "controller", "sensor"], wire: "TCP 502" },
    { id: "modbus-rtu", name: "Modbus RTU", group: "plant", devices: ["inverter", "meter", "sensor"], wire: "RS-485" },
    { id: "sunspec", name: "SunSpec Modbus", group: "plant", devices: ["inverter", "battery", "meter"], wire: "Modbus · 40000" },
    { id: "iec-61850-7-420", name: "IEC 61850-7-420", group: "plant", devices: ["inverter", "battery", "controller"], wire: "IEC 61850 MMS" },
    { id: "iec-61400-25", name: "IEC 61400-25", group: "plant", devices: ["turbine", "controller"], wire: "MMS · OPC UA" },
    { id: "canopen", name: "CAN / CANopen", group: "plant", devices: ["battery", "inverter"], wire: "CAN bus" },
    { id: "profinet", name: "PROFINET", group: "plant", devices: ["controller", "rtu", "transformer", "laptop"], wire: "Ethernet 0x8892 · UDP 34964" },
    { id: "hart", name: "HART", group: "plant", devices: ["sensor", "controller", "laptop"], wire: "FSK on 4–20 mA · 1200 bit/s" },

    { id: "ocpp", name: "OCPP", group: "ev", devices: ["charger", "cloud"], wire: "WebSocket · JSON" },
    { id: "iso-15118", name: "ISO 15118", group: "ev", devices: ["car", "charger"], wire: "PLC · TLS" },
    { id: "iec-61851", name: "IEC 61851", group: "ev", devices: ["car", "charger"], wire: "Control pilot · PWM" },
    { id: "ocpi", name: "OCPI", group: "ev", devices: ["cloud", "charger"], wire: "HTTPS · REST" },
    { id: "ieee-2030-5", name: "IEEE 2030.5", group: "ev", devices: ["inverter", "cloud"], wire: "HTTPS · TLS" },
    { id: "openadr", name: "OpenADR", group: "ev", devices: ["cloud", "building"], wire: "HTTPS" },
    { id: "eebus", name: "EEBus", group: "ev", devices: ["charger", "controller"], wire: "SHIP · TLS · mDNS" },
    { id: "oscp", name: "OSCP", group: "ev", devices: ["charger", "cloud", "transformer"], wire: "HTTPS · JSON" },

    { id: "dlms-cosem", name: "DLMS/COSEM", group: "metering", devices: ["meter"], wire: "HDLC · TCP 4059" },
    { id: "iec-62056-21", name: "IEC 62056-21", group: "metering", devices: ["meter", "laptop"], wire: "Optical port" },
    { id: "m-bus", name: "M-Bus / wM-Bus", group: "metering", devices: ["meter", "radio"], wire: "2-wire · 868 MHz" },
    { id: "ansi-c12", name: "ANSI C12.18 / 19 / 22", group: "metering", devices: ["meter", "laptop"], wire: "Optical · TCP 1153" },
    { id: "g3-plc", name: "G3-PLC / PRIME", group: "metering", devices: ["meter", "gateway", "transformer"], wire: "Power line · CENELEC A" },
    { id: "zigbee-se", name: "Zigbee Smart Energy", group: "metering", devices: ["meter", "charger"], wire: "IEEE 802.15.4 · 2.4 GHz" },

    { id: "mqtt", name: "MQTT", group: "iot", devices: ["gateway", "broker", "cloud"], wire: "TCP 1883 · TLS 8883" },
    { id: "sparkplug-b", name: "Sparkplug B", group: "iot", devices: ["gateway", "broker", "scada"], wire: "MQTT · Protobuf" },
    { id: "opc-ua", name: "OPC UA", group: "iot", devices: ["controller", "scada"], wire: "TCP 4840" },
    { id: "lorawan", name: "LoRaWAN", group: "iot", devices: ["sensor", "meter", "radio"], wire: "868 / 915 MHz" },
    { id: "bacnet", name: "BACnet/IP", group: "iot", devices: ["building", "controller"], wire: "UDP 47808" },
    { id: "matter", name: "Matter energy", group: "iot", devices: ["charger", "controller", "inverter"], wire: "IPv6 · UDP 5540" },

    { id: "iec-62351", name: "IEC 62351", group: "security", devices: ["rtu", "relay", "scada"], wire: "TLS · X.509" },
    { id: "dnp3-sa", name: "DNP3 Secure Authentication", group: "security", devices: ["rtu", "scada"], wire: "In DNP3" },
    { id: "modbus-security", name: "Modbus/TCP Security", group: "security", devices: ["inverter", "meter", "controller"], wire: "TCP 802" },
    { id: "iec-62443", name: "IEC 62443", group: "security", devices: ["scada", "switch", "controller"], wire: "Zones · conduits" },
    { id: "snmp", name: "SNMP", group: "security", devices: ["switch", "firewall", "scada"], wire: "UDP 161 · 162" },
];

export const metaOf = (id: string) => CATALOG.find((meta) => meta.id === id);
