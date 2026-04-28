import axios from "axios";

const BASE_URL = "http://localhost:5000/api";

export const getNodeData = (nodeId) =>
  axios.get(`${BASE_URL}/node/${nodeId}`).then(res => res.data);

export const getSummary = (nodeId) =>
  axios.get(`${BASE_URL}/summary/${nodeId}`).then(res => res.data);