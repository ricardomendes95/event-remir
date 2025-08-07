import { NextRequest, NextResponse } from "next/server";
import { AdminRepository } from "../repositories/AdminRepository";
import { hashPassword } from "../utils/password";
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
} from "../schemas";
import { ZodError } from "zod";

export class UserController {
  private adminRepository: AdminRepository;

  constructor() {
    this.adminRepository = new AdminRepository();
  }

  // Listar todos os usuários
  async getUsers(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const search = url.searchParams.get("search") || "";

      const users = await this.adminRepository.findAllWithPagination({
        page,
        limit,
        search,
        searchFields: ["name", "email"],
      });

      return NextResponse.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }

  // Buscar usuário por ID
  async getUserById(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split("/");
      const id = pathSegments[pathSegments.length - 1];

      if (!id) {
        return NextResponse.json(
          { success: false, error: "ID do usuário é obrigatório" },
          { status: 400 }
        );
      }

      const user = await this.adminRepository.findByIdSafe(id);

      if (!user) {
        return NextResponse.json(
          { success: false, error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }

  // Criar novo usuário
  async createUser(req: NextRequest): Promise<NextResponse> {
    try {
      const body = await req.json();

      // Validar dados com Zod
      const validatedData = createUserSchema.parse(body);

      // Verificar se email já existe
      const existingUser = await this.adminRepository.findByEmail(
        validatedData.email
      );
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: "Email já está em uso" },
          { status: 400 }
        );
      }

      // Hash da senha
      const hashedPassword = await hashPassword(validatedData.password);

      // Criar usuário
      const userData = {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role || "ADMIN",
        isActive: validatedData.isActive ?? true,
        lastLoginAt: null,
      };

      const user = await this.adminRepository.create(userData);

      // Retornar usuário sem senha
      const safeUser = await this.adminRepository.findByIdSafe(user.id);

      return NextResponse.json(
        {
          success: true,
          data: safeUser,
          message: "Usuário criado com sucesso",
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: "Dados inválidos",
            details: error.issues,
          },
          { status: 400 }
        );
      }

      console.error("Error creating user:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }

  // Atualizar usuário
  async updateUser(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split("/");
      const id = pathSegments[pathSegments.length - 1];

      if (!id) {
        return NextResponse.json(
          { success: false, error: "ID do usuário é obrigatório" },
          { status: 400 }
        );
      }

      const body = await req.json();

      // Validar dados com Zod
      const validatedData = updateUserSchema.parse(body);

      // Verificar se usuário existe
      const existingUser = await this.adminRepository.findById(id);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      // Se email está sendo alterado, verificar se não está em uso
      if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailInUse = await this.adminRepository.findByEmail(
          validatedData.email
        );
        if (emailInUse) {
          return NextResponse.json(
            { success: false, error: "Email já está em uso" },
            { status: 400 }
          );
        }
      }

      // Preparar dados para atualização (sem senha)
      type UpdateData = {
        name?: string;
        email?: string;
        role?: "ADMIN" | "SUPER_ADMIN";
        isActive?: boolean;
      };

      const updateData: UpdateData = {};
      if (validatedData.name !== undefined)
        updateData.name = validatedData.name;
      if (validatedData.email !== undefined)
        updateData.email = validatedData.email;
      if (validatedData.role !== undefined)
        updateData.role = validatedData.role;
      if (validatedData.isActive !== undefined)
        updateData.isActive = validatedData.isActive;

      // Atualizar usuário
      await this.adminRepository.update(id, updateData);

      // Buscar usuário atualizado
      const updatedUser = await this.adminRepository.findByIdSafe(id);

      return NextResponse.json({
        success: true,
        data: updatedUser,
        message: "Usuário atualizado com sucesso",
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: "Dados inválidos",
            details: error.issues,
          },
          { status: 400 }
        );
      }

      console.error("Error updating user:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }

  // Alterar senha do usuário
  async changePassword(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split("/");
      const id = pathSegments[pathSegments.indexOf("change-password") - 1];

      if (!id) {
        return NextResponse.json(
          { success: false, error: "ID do usuário é obrigatório" },
          { status: 400 }
        );
      }

      const body = await req.json();

      // Validar dados com Zod
      const validatedData = changePasswordSchema.parse(body);

      // Verificar se usuário existe
      const existingUser = await this.adminRepository.findById(id);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      // Hash da nova senha
      const hashedPassword = await hashPassword(validatedData.newPassword);

      // Atualizar senha
      await this.adminRepository.update(id, { password: hashedPassword });

      return NextResponse.json({
        success: true,
        message: "Senha alterada com sucesso",
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: "Dados inválidos",
            details: error.issues,
          },
          { status: 400 }
        );
      }

      console.error("Error changing password:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }

  // Deletar usuário
  async deleteUser(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split("/");
      const id = pathSegments[pathSegments.length - 1];

      if (!id) {
        return NextResponse.json(
          { success: false, error: "ID do usuário é obrigatório" },
          { status: 400 }
        );
      }

      // Verificar se usuário existe
      const existingUser = await this.adminRepository.findById(id);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      // Deletar usuário
      await this.adminRepository.delete(id);

      return NextResponse.json({
        success: true,
        message: "Usuário deletado com sucesso",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }

  // Toggle status do usuário (ativar/desativar)
  async toggleUserStatus(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split("/");
      const id = pathSegments[pathSegments.indexOf("toggle-status") - 1];

      if (!id) {
        return NextResponse.json(
          { success: false, error: "ID do usuário é obrigatório" },
          { status: 400 }
        );
      }

      // Verificar se usuário existe
      const existingUser = await this.adminRepository.findById(id);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      // Alternar status
      const newStatus = !existingUser.isActive;
      await this.adminRepository.update(id, { isActive: newStatus });

      // Buscar usuário atualizado
      const updatedUser = await this.adminRepository.findByIdSafe(id);

      return NextResponse.json({
        success: true,
        data: updatedUser,
        message: `Usuário ${newStatus ? "ativado" : "desativado"} com sucesso`,
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }
  }
}

export const userController = new UserController();
