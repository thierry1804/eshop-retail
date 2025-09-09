import { supabase } from './supabase';

export interface LogEntry {
  id?: string;
  user_id: string;
  user_email: string;
  action: string;
  page: string;
  url: string;
  component: string;
  details: any;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private batchSize = 10;
  private flushInterval = 30000; // 30 secondes
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startBatchFlush();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private startBatchFlush() {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  private async flushLogs() {
    if (this.logs.length === 0) return;

    try {
      const logsToFlush = [...this.logs];
      this.logs = [];

      // Envoyer les logs à Supabase
      const { error } = await supabase
        .from('user_logs')
        .insert(logsToFlush);

      if (error) {
        console.error('❌ Logger: Erreur lors de l\'envoi des logs:', error);
        // Remettre les logs en queue en cas d'erreur
        this.logs.unshift(...logsToFlush);
      } else {
        console.log(`✅ Logger: ${logsToFlush.length} logs envoyés avec succès`);
      }
    } catch (error) {
      console.error('❌ Logger: Erreur critique lors du flush:', error);
    }
  }

  public async log(action: string, details: any = {}) {
    try {
      // Récupérer les informations de l'utilisateur
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        console.warn('⚠️ Logger: Aucun utilisateur connecté, log ignoré');
        return;
      }

      const logEntry: LogEntry = {
        user_id: user.id,
        user_email: user.email || 'unknown',
        action,
        page: window.location.pathname,
        url: window.location.href,
        component: details.component || 'Unknown',
        details: {
          ...details,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          screenResolution: `${screen.width}x${screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        },
        timestamp: new Date().toISOString(),
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
      };

      // Ajouter à la queue locale
      this.logs.push(logEntry);
      console.log('📝 Logger:', action, details);

      // Flush immédiat si on atteint la taille de batch
      if (this.logs.length >= this.batchSize) {
        await this.flushLogs();
      }
    } catch (error) {
      console.error('❌ Logger: Erreur lors de la création du log:', error);
    }
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // Méthodes spécialisées pour différents types d'actions
  public async logNavigation(from: string, to: string) {
    await this.log('NAVIGATION', {
      component: 'Router',
      from,
      to,
      type: 'page_change'
    });
  }

  public async logFormSubmit(formName: string, formData: any, success: boolean) {
    await this.log('FORM_SUBMIT', {
      component: formName,
      formData: this.sanitizeFormData(formData),
      success,
      type: 'form_action'
    });
  }

  public async logCRUDAction(action: 'CREATE' | 'UPDATE' | 'DELETE', table: string, recordId: string, data?: any) {
    await this.log('CRUD_ACTION', {
      component: table,
      action,
      recordId,
      data: data ? this.sanitizeFormData(data) : null,
      type: 'database_action'
    });
  }

  public async logError(error: Error, context: string) {
    await this.log('ERROR', {
      component: context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      type: 'error'
    });
  }

  public async logUserAction(action: string, component: string, details: any = {}) {
    await this.log('USER_ACTION', {
      component,
      action,
      ...details,
      type: 'user_interaction'
    });
  }

  private sanitizeFormData(data: any): any {
    // Nettoyer les données sensibles
    const sanitized = { ...data };
    
    // Masquer les mots de passe
    if (sanitized.password) sanitized.password = '[MASKED]';
    if (sanitized.confirmPassword) sanitized.confirmPassword = '[MASKED]';
    
    // Limiter la taille des données
    const jsonString = JSON.stringify(sanitized);
    if (jsonString.length > 10000) {
      return { ...sanitized, _truncated: true, _originalSize: jsonString.length };
    }
    
    return sanitized;
  }

  public async forceFlush() {
    await this.flushLogs();
  }

  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushLogs();
  }
}

// Export de l'instance singleton
export const logger = Logger.getInstance();

// Hook React pour utiliser le logger
export const useLogger = () => {
  return {
    log: logger.log.bind(logger),
    logNavigation: logger.logNavigation.bind(logger),
    logFormSubmit: logger.logFormSubmit.bind(logger),
    logCRUDAction: logger.logCRUDAction.bind(logger),
    logError: logger.logError.bind(logger),
    logUserAction: logger.logUserAction.bind(logger),
  };
};
