const DEFAULT_PROFILE_PHOTO = 'https://i.pravatar.cc/150?u=eventapp';
const STAFF_CATEGORIES = ['BARISTAS', 'IMPULSADORES', 'LOGISTICOS'];

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();
const normalizePhoneValue = (value) => String(value || '').replace(/\D/g, '');

const sanitizeUserRecord = (user) => ({
  id: Number(user.id),
  username: user.username,
  fullName: user.fullName || user.full_name,
  phone: user.phone || null,
  whatsappPhone: user.whatsappPhone || user.whatsapp_phone || null,
  email: user.email || null,
  role: user.role,
});

const sanitizeCoordinatorAdminRecord = ({ coordinator, user = null }) => ({
  id: Number(coordinator.id),
  userId: Number(coordinator.userId || coordinator.user_id || user?.id || 0) || null,
  username: user?.username || null,
  fullName: coordinator.name || coordinator.fullName || coordinator.full_name,
  cedula: coordinator.cedula,
  address: coordinator.address,
  phone: coordinator.phone || null,
  whatsappPhone: user?.whatsappPhone || user?.whatsapp_phone || null,
  email: user?.email || null,
  city: coordinator.city,
  rating: Number(coordinator.rating || 0),
  photo: coordinator.photo || DEFAULT_PROFILE_PHOTO,
});

const sanitizeStaffAdminRecord = (staffMember) => ({
  id: Number(staffMember.id),
  fullName: staffMember.name || staffMember.fullName || staffMember.full_name,
  cedula: staffMember.cedula,
  city: staffMember.city,
  category: staffMember.category,
  photo: staffMember.photo || DEFAULT_PROFILE_PHOTO,
  clothingSize: staffMember.clothingSize || staffMember.clothing_size || null,
  shoeSize: staffMember.shoeSize || staffMember.shoe_size || null,
  measurements: staffMember.measurements || null,
});

module.exports = {
  DEFAULT_PROFILE_PHOTO,
  STAFF_CATEGORIES,
  normalizeComparableValue,
  normalizePhoneValue,
  sanitizeCoordinatorAdminRecord,
  sanitizeStaffAdminRecord,
  sanitizeUserRecord,
};
