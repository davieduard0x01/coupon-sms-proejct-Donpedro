// ARQUIVO: backend/index.js (VERSÃO CORRIGIDA: NORMALIZAÇÃO CONSISTENTE)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid'); 
const twilio = require('twilio'); 
const moment = require('moment-timezone'); 

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configurações Fixas ---
const FIXED_COUPON_CODE = "D0nP3dro20"; 

// URL do Frontend (Vercel)
const VERCEL_FRONTEND_URL = 'https://coupon-sms-proejct-donpedro.vercel.app';

const corsOptions = {
    origin: [VERCEL_FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Inicialização dos serviços
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// --- Funções de Ajuda ---

const normalizePhoneNumber = (number) => {
    // Remove tudo que não for dígito
    const digits = number.replace(/\D/g, '');
    
    // Se já tiver o código do país (começa com 1 e tem 11 digitos), adiciona +
    if (digits.length === 11 && digits.startsWith('1')) { 
        return `+${digits}`; 
    }
    // Se for numero dos EUA (10 dígitos), adiciona +1
    if (digits.length === 10) { 
        return `+1${digits}`; 
    }
    // Fallback para outros casos (assume que já está formatado ou é internacional)
    return `+${digits}`; 
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Middlewares
const authenticateAccess = async (req, res, next) => {
    const token = req.header('X-Auth-Token');
    if (!token) { return res.status(401).json({ message: 'Token de autenticação ausente.' }); }
    try {
        const [usuario, nivel] = token.split(':');
        const { data, error } = await supabase.from('users_acesso').select('nivel').eq('usuario', usuario).limit(1);
        if (error || !data || data.length === 0) { return res.status(401).json({ message: 'Usuário inválido.' }); }
        req.user_nivel = data[0].nivel; 
        req.user_usuario = usuario;
        next();
    } catch (e) { return res.status(401).json({ message: 'Token inválido.' }); }
};

const requireAdmin = (req, res, next) => {
    if (req.user_nivel !== 'ADMIN') { return res.status(403).json({ message: 'Acesso negado.' }); }
    next();
};


// ----------------------------------------------------
// --- ROTA 1: ENVIAR OTP ---
// ----------------------------------------------------

app.post('/api/send-otp', async (req, res) => {
    const { name, phone, address } = req.body; 
    
    if (!name || !phone || !address) { return res.status(400).json({ message: 'Todos os campos são obrigatórios.' }); }
    
    // NORMALIZAÇÃO (Garante +1 para EUA)
    const normalizedNumber = normalizePhoneNumber(phone);
    
    // 1. Verifica usuário existente
    let existingUserName = name;
    try {
        const { data: cupons } = await supabase.from('leads_cupons').select('nome').eq('telefone', normalizedNumber).limit(1);
        if (cupons && cupons.length > 0) { existingUserName = cupons[0].nome; }
    } catch (dbError) { return res.status(500).json({ message: 'Erro no banco de dados.' }); }
    
    // 2. Salvar sessão
    const otpCode = generateOTP();
    const expiryTime = moment.utc().add(5, 'minutes').toISOString(); 
    
    const otpSessionData = {
        telefone: normalizedNumber, // Salva com +1
        codigo_otp: otpCode,
        expira_em: expiryTime,
    };
    
    try {
        const { error: otpError } = await supabase.from('otp_sessions').upsert([otpSessionData], { onConflict: 'telefone' }); 
        if (otpError) throw otpError;
    } catch (e) {
        console.error('Erro sessão OTP:', e);
        return res.status(500).json({ message: 'Erro ao criar sessão.' });
    }

    // 3. Envio do SMS
    try {
        await twilioClient.messages.create({
            body: `Seu código de verificação DONPEDRO é ${otpCode}. Válido por 5 minutos.`,
            from: process.env.TWILIO_PHONE_NUMBER, 
            to: normalizedNumber, 
        });

        return res.status(200).json({ 
            message: `Código enviado para ${normalizedNumber}.`,
            phone: normalizedNumber, 
            status: 'pending'
        });

    } catch (e) {
        // Fallback para testes se a conta ainda estiver com restrição
        if (e.code === 21608) {
            return res.status(200).json({ 
                message: `AVISO (TRIAL): Use o código ${otpCode}.`,
                phone: normalizedNumber, 
                status: 'pending',
                otpCode: otpCode 
            });
        }
        console.error('Erro Twilio:', e);
        return res.status(500).json({ message: 'Erro ao enviar SMS.'});
    }
});


// ----------------------------------------------------
// --- ROTA 2: CHECAR OTP (A CORREÇÃO ESTÁ AQUI) ---
// ----------------------------------------------------

app.post('/api/check-otp', async (req, res) => {
    const { phone, code, name, address } = req.body; 
    
    if (!phone || !code || !name || !address) { return res.status(400).json({ message: 'Dados incompletos.' }); }
    
    // >>> CORREÇÃO CRÍTICA: USA A MESMA NORMALIZAÇÃO DO SEND-OTP <<<
    // Antes estava apenas adicionando '+', agora garante o '+1' se for EUA
    const normalizedNumber = normalizePhoneNumber(phone);

    try {
        const { data: session, error: sessionError } = await supabase
            .from('otp_sessions')
            .select('codigo_otp, expira_em')
            .eq('telefone', normalizedNumber) // Busca pelo número normalizado corretamente
            .limit(1);

        if (sessionError || !session || session.length === 0) {
            // Se cair aqui, verifique os logs do servidor para ver qual número chegou vs qual está no banco
            console.log(`Falha de busca. Tentou buscar: ${normalizedNumber}`);
            return res.status(401).json({ message: 'Sessão não encontrada (Verifique o número).' });
        }
        
        const storedCode = session[0].codigo_otp;
        const expiryTime = moment.parseZone(session[0].expira_em); 
        const isExpired = expiryTime.isBefore(moment.utc()); 
        const isCodeValid = (code === storedCode);
        
        if (isExpired) {
            await supabase.from('otp_sessions').delete().eq('telefone', normalizedNumber);
            return res.status(401).json({ message: 'Código expirado.' });
        }
        
        if (!isCodeValid) {
            return res.status(401).json({ message: 'Código inválido.' });
        }

        // --- SUCESSO ---
        await supabase.from('otp_sessions').delete().eq('telefone', normalizedNumber);
        
        const { data: existingCupons } = await supabase.from('leads_cupons').select('*').eq('telefone', normalizedNumber);

        if (existingCupons && existingCupons.length > 0) {
            const cuponsValidos = existingCupons.filter(c => c.status_uso === 'NAO_UTILIZADO');
            const cupomPrincipal = cuponsValidos.length > 0 ? cuponsValidos[0].coupon_uuid : existingCupons[0].coupon_uuid;

            return res.status(200).json({ 
                message: `Acesso verificado. Cupons recuperados.`,
                couponUUID: cupomPrincipal, 
                couponCode: FIXED_COUPON_CODE,
                isExistingUser: true
            });
        } else {
            const couponUUID = uuidv4(); 
            const registrationData = {
                coupon_uuid: couponUUID,
                nome: name,
                telefone: normalizedNumber, 
                endereco: address,
                status_uso: 'NAO_UTILIZADO',
                coupon_code: FIXED_COUPON_CODE, 
            };

            await supabase.from('leads_cupons').insert([registrationData]);

            return res.status(200).json({ 
                message: `Cadastro finalizado com sucesso!`,
                couponUUID: couponUUID, 
                couponCode: FIXED_COUPON_CODE 
            });
        }

    } catch (e) {
        console.error('Erro Check OTP:', e);
        return res.status(500).json({ message: 'Erro interno.' });
    }
});


// ----------------------------------------------------
// --- ROTAS DE ACESSO E ADMIN ---
// ----------------------------------------------------

// ... (Rotas de Login, Validate, Admin Leads permanecem as mesmas) ...

app.post('/auth/login', async (req, res) => { /* ... */ });
app.post('/func/validate', authenticateAccess, async (req, res) => { /* ... */ });
app.get('/admin/leads', authenticateAccess, requireAdmin, async (req, res) => { /* ... */ });

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});