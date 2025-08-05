import { prisma } from "../../lib/prisma";
import { BaseRepository } from "./BaseRepository";

// Tipos baseados no schema Prisma atualizado
export interface Admin {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "SUPER_ADMIN" | "ADMIN";
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeAdmin = Omit<Admin, "password">;

export class AdminRepository extends BaseRepository<Admin> {
  constructor() {
    super(prisma.admin);
  }

  async findByEmail(email: string): Promise<Admin | null> {
    try {
      return await prisma.admin.findUnique({
        where: { email },
      });
    } catch (error) {
      console.error("Error finding admin by email:", error);
      throw new Error("Erro ao buscar administrador por email");
    }
  }

  async findByEmailSafe(email: string): Promise<SafeAdmin | null> {
    try {
      return await prisma.admin.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error("Error finding admin by email (safe):", error);
      throw new Error("Erro ao buscar administrador por email");
    }
  }

  async findAllSafe(options?: {
    skip?: number;
    take?: number;
    role?: "SUPER_ADMIN" | "ADMIN";
    isActive?: boolean;
  }): Promise<SafeAdmin[]> {
    try {
      const where: { role?: "SUPER_ADMIN" | "ADMIN"; isActive?: boolean } = {};

      if (options?.role) {
        where.role = options.role;
      }

      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      return await prisma.admin.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: options?.skip,
        take: options?.take,
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error) {
      console.error("Error finding all admins (safe):", error);
      throw new Error("Erro ao buscar administradores");
    }
  }

  async createAdmin(data: {
    name: string;
    email: string;
    password: string;
    role?: "SUPER_ADMIN" | "ADMIN";
  }): Promise<SafeAdmin> {
    try {
      const admin = await prisma.admin.create({
        data: {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role || "ADMIN",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return admin;
    } catch (error) {
      console.error("Error creating admin:", error);
      throw new Error("Erro ao criar administrador");
    }
  }

  async updatePassword(id: string, newPassword: string): Promise<SafeAdmin> {
    try {
      return await prisma.admin.update({
        where: { id },
        data: { password: newPassword },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error("Error updating admin password:", error);
      throw new Error("Erro ao atualizar senha do administrador");
    }
  }

  async updateProfile(
    id: string,
    data: {
      name?: string;
      email?: string;
    }
  ): Promise<SafeAdmin> {
    try {
      return await prisma.admin.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error("Error updating admin profile:", error);
      throw new Error("Erro ao atualizar perfil do administrador");
    }
  }

  async updateRole(
    id: string,
    role: "SUPER_ADMIN" | "ADMIN"
  ): Promise<SafeAdmin> {
    try {
      return await prisma.admin.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error("Error updating admin role:", error);
      throw new Error("Erro ao atualizar role do administrador");
    }
  }

  async toggleActive(id: string): Promise<SafeAdmin> {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id },
        select: { isActive: true },
      });

      if (!admin) {
        throw new Error("Administrador não encontrado");
      }

      return await prisma.admin.update({
        where: { id },
        data: { isActive: !admin.isActive },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error("Error toggling admin active status:", error);
      throw new Error("Erro ao alterar status ativo do administrador");
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await prisma.admin.update({
        where: { id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      console.error("Error updating last login:", error);
      throw new Error("Erro ao atualizar último login");
    }
  }

  async getSafeById(id: string): Promise<SafeAdmin | null> {
    try {
      return await prisma.admin.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error("Error finding admin by id (safe):", error);
      throw new Error("Erro ao buscar administrador por ID");
    }
  }

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    try {
      const where: { email: string; id?: { not: string } } = { email };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const admin = await prisma.admin.findFirst({
        where,
        select: { id: true },
      });

      return !!admin;
    } catch (error) {
      console.error("Error checking if email exists:", error);
      throw new Error("Erro ao verificar se email já existe");
    }
  }

  async countAdmins(filters?: {
    role?: "SUPER_ADMIN" | "ADMIN";
    isActive?: boolean;
  }): Promise<number> {
    try {
      const where: { role?: "SUPER_ADMIN" | "ADMIN"; isActive?: boolean } = {};

      if (filters?.role) {
        where.role = filters.role;
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      return await prisma.admin.count({ where });
    } catch (error) {
      console.error("Error counting admins:", error);
      throw new Error("Erro ao contar administradores");
    }
  }
}
