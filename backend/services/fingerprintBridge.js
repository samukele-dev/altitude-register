const axios = require('axios');

// Converts a Firestore document ID (string) to a stable uint32
// by hashing it. Produces the same number every call for the same ID.
function firestoreIdToUint32(firestoreId) {
  let hash = 0;
  for (let i = 0; i < firestoreId.length; i++) {
    const char = firestoreId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // keep 32-bit
  }
  return hash >>> 0; // make unsigned
}

class FingerprintBridge {
  constructor() {
    this.bridgeUrl = 'http://localhost:8092';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Converts any standard template (ISO 19794-2 or ANSI 378) to SG400 format.
  // Returns a base64 string that is exactly 400 bytes when decoded.
  // type: 'iso' (default) | 'ansi'
  // view: which finger view to extract (default 0)
  async extractToSG400(templateBase64, type = 'iso', view = 0) {
    try {
      const response = await axios.post(`${this.bridgeUrl}/extract`, {
        template: templateBase64,
        type,
        view
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Extraction failed');
      }

      return { success: true, sg400: response.data.sg400, views: response.data.views };
    } catch (error) {
      console.error('Bridge extract error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ensures a template is in SG400 format (400 bytes).
  // If the decoded template is already 400 bytes, returns it as-is.
  // Otherwise, sends it to /extract for conversion.
  async ensureSG400(templateBase64, type = 'iso') {
    const decoded = Buffer.from(templateBase64, 'base64');

    if (decoded.length === 400) {
      // Already SG400 — pass through
      return { success: true, sg400: templateBase64 };
    }

    console.log(`  🔄 Template is ${decoded.length} bytes — converting to SG400 via /extract...`);
    return this.extractToSG400(templateBase64, type);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registers a fingerprint. Accepts ISO 19794-2, ANSI 378, or SG400 templates.
  // Automatically converts non-SG400 templates before sending to /register.
  async register(templateBase64, firestoreDocId, type = 'iso') {
    try {
      // Convert to SG400 if needed
      const converted = await this.ensureSG400(templateBase64, type);
      if (!converted.success) {
        return { success: false, error: `Template conversion failed: ${converted.error}` };
      }

      const bridgeId = firestoreIdToUint32(firestoreDocId);
      console.log(`  🔢 Firestore ID "${firestoreDocId}" → bridge uint32: ${bridgeId}`);

      const response = await axios.post(`${this.bridgeUrl}/register`, {
        template: converted.sg400,
        id: bridgeId
      });

      return { ...response.data, bridgeId };
    } catch (error) {
      console.error('Bridge register error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Identifies a fingerprint via 1:N matching.
  // Accepts ISO 19794-2, ANSI 378, or SG400 templates — auto-converts if needed.
  // Returns { success, matched_id } where matched_id is a uint32 bridge ID.
  // Use reverseLookup() or query Firestore by bridgeId field to get the user.
  async identify(templateBase64, securityLevel = 5, type = 'iso') {
    try {
      // Convert to SG400 if needed
      const converted = await this.ensureSG400(templateBase64, type);
      if (!converted.success) {
        return { success: false, error: `Template conversion failed: ${converted.error}` };
      }

      const response = await axios.post(`${this.bridgeUrl}/identify`, {
        template: converted.sg400,
        security_level: securityLevel
      });

      return response.data;
    } catch (error) {
      console.error('Bridge identify error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Removes a template from the bridge by Firestore document ID.
  async remove(firestoreDocId) {
    try {
      const bridgeId = firestoreIdToUint32(firestoreDocId);
      const response = await axios.post(`${this.bridgeUrl}/remove`, { id: bridgeId });
      return response.data;
    } catch (error) {
      console.error('Bridge remove error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Converts a uint32 bridge ID back to a Firestore document ID.
  // Fast path: query users where bridgeId == matched_id (stored on enroll).
  // Slow path fallback: scan all users and hash each doc ID.
  async reverseLookup(bridgeUint32Id, db) {
    try {
      // Fast path — bridgeId field stored on the user document at enrollment
      const fastQuery = await db.collection('users')
        .where('bridgeId', '==', bridgeUint32Id)
        .limit(1)
        .get();

      if (!fastQuery.empty) {
        return fastQuery.docs[0].id;
      }

      // Slow path fallback (for users enrolled before bridgeId field was added)
      console.warn('  ⚠️  Fast bridgeId lookup missed — falling back to full scan');
      const snapshot = await db.collection('users').get();
      for (const doc of snapshot.docs) {
        if (firestoreIdToUint32(doc.id) === bridgeUint32Id) {
          // Backfill the bridgeId field for next time
          await doc.ref.update({ bridgeId: bridgeUint32Id }).catch(() => {});
          return doc.id;
        }
      }

      return null;
    } catch (error) {
      console.error('Reverse lookup error:', error.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
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
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = new FingerprintBridge();
module.exports.firestoreIdToUint32 = firestoreIdToUint32;