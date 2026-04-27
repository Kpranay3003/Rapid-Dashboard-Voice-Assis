export const nodesConfig = [
  // Row 1
  { id: "cop hop",          label: "COP – Order\nCreation",           x: 60,  y: 40  },
  { id: "och hop",          label: "OCH – Order\nEntry",              x: 230, y: 40  },
  { id: "sap hop",          label: "SAP-Sales Order\ncreation",       x: 400, y: 40  },
  { id: "sap delivery hop", label: "SAP-Delivery\nCreation",          x: 570, y: 40  },
  { id: "och del hop",      label: "OCH – Delivery\nAcknowledgement", x: 740, y: 40  },
  // Row 2
  { id: "cop del hop",      label: "COP – Delivery\nAcknowledgement", x: 60,  y: 200 },
  { id: "wms rep hop",      label: "WMS –\nReplication",              x: 280, y: 200 },
  { id: "wms pgi hop",      label: "WMS-PGI Status",                  x: 490, y: 200 },
];

export const edgesConfig = [
  { id: "e1", source: "cop hop",          target: "och hop",          type: "straight" },
  { id: "e2", source: "och hop",          target: "sap hop",          type: "straight" },
  { id: "e3", source: "sap hop",          target: "sap delivery hop", type: "straight" },
  { id: "e4", source: "sap delivery hop", target: "och del hop",      type: "straight" },
  { id: "e5", source: "cop del hop",      target: "wms rep hop",      type: "straight" },
  { id: "e6", source: "wms rep hop",      target: "wms pgi hop",      type: "straight" },
];
