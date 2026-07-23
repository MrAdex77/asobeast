"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/api";
import { invalidateAuth } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { useAuth } from "./use-auth";

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      invalidateAuth(queryClient);
      router.replace("/login");
    },
    onError: () => toast.error("Could not sign out."),
  });

  if (!status?.enabled || !user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Account menu">
          <User />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate font-medium">{user.email}</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {user.plan}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ChangePasswordDialog
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Change password
            </DropdownMenuItem>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signOut.isPending}
          onSelect={(event) => {
            event.preventDefault();
            signOut.mutate();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
