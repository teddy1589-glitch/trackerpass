export type ManagerProfile = {
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  telegram?: string;
  site?: string;
};

const profiles: Record<number, ManagerProfile> = {
  // 123456: {
  //   full_name: "Имя Фамилия",
  //   avatar_url: "https://example.com/avatar.jpg",
  //   phone: "+7 (900) 000-00-00",
  //   email: "name@domain.ru",
  //   whatsapp: "+79000000000",
  //   telegram: "username",
  //   site: "rte-consult.ru",
  // },
};

export function getManagerProfile(userId?: number | null): ManagerProfile | null {
  if (!userId) {
    return null;
  }
  return profiles[userId] ?? null;
}
