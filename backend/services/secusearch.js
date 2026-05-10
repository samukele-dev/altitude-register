const axios = require('axios');

class SecuSearchService {
  constructor() {
    this.bridgeUrl = 'http://localhost:8090';
  }

  async register(templateBase64, employeeId) {
    try {
      const response = await axios.post(`${this.bridgeUrl}/register`, {
        template: templateBase64,
        id: employeeId
      });
      return response.data;
    } catch (error) {
      console.error('SecuSearch register error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async identify(templateBase64, securityLevel = 6) {
    try {
      const response = await axios.post(`${this.bridgeUrl}/identify`, {
        template: templateBase64,
        security_level: securityLevel
      });
      return response.data;
    } catch (error) {
      console.error('SecuSearch identify error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async remove(employeeId) {
    try {
      const response = await axios.post(`${this.bridgeUrl}/remove`, {
        id: employeeId
      });
      return response.data;
    } catch (error) {
      console.error('SecuSearch remove error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getCount() {
    try {
      const response = await axios.get(`${this.bridgeUrl}/count`);
      return response.data;
    } catch (error) {
      return { count: 0 };
    }
  }

  async health() {
    try {
      const response = await axios.get(`${this.bridgeUrl}/health`);
      return response.data;
    } catch (error) {
      return { status: 'error', initialized: false };
    }
  }
}

module.exports = new SecuSearchService();