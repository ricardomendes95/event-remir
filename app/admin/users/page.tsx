"use client";

import { UserManagement } from "../../../components/admin/UserManagement";
import AdminHeader from "../components/AdminHeader";

export default function UsersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="container mx-auto px-4 py-8">
        <UserManagement />
      </div>
    </div>
  );
}
