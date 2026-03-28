const { db } = require('./config/firebase');

async function createCollections() {
  try {
    // Create campaigns collection with sample data
    const campaigns = ['Sales', 'Support', 'Retention', 'Tech Support'];
    for (const campaign of campaigns) {
      await db.collection('campaigns').doc(campaign).set({
        name: campaign,
        description: `${campaign} Campaign`,
        agentCount: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      console.log(`✅ Campaign created: ${campaign}`);
    }
    
    // Create teams collection with sample data
    const teams = [
      { name: 'Alpha', campaign: 'Sales' },
      { name: 'Beta', campaign: 'Sales' },
      { name: 'Gamma', campaign: 'Support' },
      { name: 'Delta', campaign: 'Retention' },
      { name: 'Epsilon', campaign: 'Tech Support' }
    ];
    
    for (const team of teams) {
      await db.collection('teams').doc(team.name).set({
        name: team.name,
        campaign: team.campaign,
        agentCount: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      console.log(`✅ Team created: ${team.name}`);
    }
    
    // Create live_status document
    await db.collection('live_status').doc('current').set({
      totalClockedIn: 0,
      byCampaign: {},
      byTeam: {},
      lastUpdated: new Date().toISOString()
    });
    console.log('✅ Live status document created');
    
    console.log('\n🎉 All collections created successfully!');
  } catch (error) {
    console.error('❌ Failed to create collections:', error.message);
  }
}

createCollections();