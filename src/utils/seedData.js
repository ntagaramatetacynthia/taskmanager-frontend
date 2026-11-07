import { District, DistrictAdmin } from '../database.js';
import bcrypt from 'bcrypt';

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Create Rwanda Districts
    const districts = [
      { name: 'Kigali City', code: 'KGL' },
      { name: 'Eastern Province', code: 'EST' },
      { name: 'Northern Province', code: 'NTH' },
      { name: 'Southern Province', code: 'STH' },
      { name: 'Western Province', code: 'WST' }
    ];

    const createdDistricts = await District.bulkCreate(districts, {
      ignoreDuplicates: true
    });

    console.log(`✅ Created ${createdDistricts.length} districts`);

    // Create sample District Admins
    const kigaliDistrict = await District.findOne({ where: { code: 'KGL' } });
    
    if (kigaliDistrict) {
      const adminExists = await DistrictAdmin.findOne({
        where: { email: 'admin.kigali@gov.rw' }
      });

      if (!adminExists) {
        await DistrictAdmin.create({
          name: 'Kigali District Administrator',
          email: 'admin.kigali@gov.rw',
          password: 'Admin123!', // Will be hashed by model hook
          phone: '+250788123456',
          district_id: kigaliDistrict.id,
          status: 'active'
        });

        console.log('✅ Created sample District Admin for Kigali');
        console.log('📧 Email: admin.kigali@gov.rw');
        console.log('🔑 Password: Admin123!');
      }
    }

    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

export default seedData;