import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UseTaquilleraNotificationsProps {
    onStatusChange?: (status: 'aprobado' | 'rechazado', date: Date) => void;
}

export const useTaquilleraNotifications = ({ onStatusChange }: UseTaquilleraNotificationsProps = {}) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // Track notified statuses to avoid duplicates
    const lastNotifiedStatusRef = useRef<Record<string, string>>({});

    useEffect(() => {
        if (!user) return;

        const channelName = `cuadre-notifications-${user.id}-${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'daily_cuadres_summary',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newStatus = payload.new.encargada_status;
                    const oldStatus = payload.old?.encargada_status;
                    const observations = payload.new.encargada_observations;
                    const sessionDate = payload.new.session_date;

                    // Only notify if status changed to rejected or approved
                    if (newStatus !== oldStatus && (newStatus === 'rechazado' || newStatus === 'aprobado')) {
                        const statusKey = `${payload.new.id}-${newStatus}`;

                        // Prevent duplicate notifications
                        if (lastNotifiedStatusRef.current[statusKey]) {
                            return;
                        }

                        lastNotifiedStatusRef.current[statusKey] = newStatus;
                        const dateObj = new Date(sessionDate);
                        const dateFormatted = format(dateObj, "dd 'de' MMMM, yyyy", { locale: es });

                        if (newStatus === 'rechazado') {
                            toast({
                                title: '❌ Cuadre Rechazado',
                                description: `Tu cuadre del ${dateFormatted} fue rechazado por la encargada.${observations ? ` Observaciones: ${observations}` : ''}`,
                                variant: 'destructive',
                                duration: 10000,
                            });
                        } else if (newStatus === 'aprobado') {
                            toast({
                                title: '✅ Cuadre Aprobado',
                                description: `Tu cuadre del ${dateFormatted} ha sido aprobado por la encargada.`,
                                duration: 5000,
                            });
                        }

                        // Trigger callback if provided
                        if (onStatusChange) {
                            onStatusChange(newStatus, dateObj);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, toast, onStatusChange]);
};
