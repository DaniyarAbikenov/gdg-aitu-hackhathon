import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import { getAuth, signOut } from "firebase/auth";

export function TopBar() {
    const navigate = useNavigate();
    const auth = getAuth();

    async function handleLogout() {
        try {
            await signOut(auth);
            navigate("/login");
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <header className="h-14 border-b bg-card flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger />
            </div>

            <div className="flex items-center gap-2">
                <LanguageSwitcher />

                {/* Dropdown menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-accent"
                        >
                            <User className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate("/onboarding")}>
                            Изменить профиль
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={handleLogout}>
                            Выйти
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
