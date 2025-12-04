// ARQUIVO: backend/index.js (CÓDIGO FINAL COM CORREÇÃO CRÍTICA DE TIMEZONE PARSING)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid'); 
const twilio = require('twilio'); 
const moment = require('moment-timezone'); // Usando moment-timezone

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

// --- Funções de Ajuda e Middlewares (Omitidas para brevidade, mas mantidas) ---

const normalizePhoneNumber = (number) => {
    const digits = number.replace(/\D/g, '');
    if (number.startsWith('+')) { return number; }
    if (digits.length === 10) { return `+1${digits}`; }
    if (digits.length === 11 && digits.startsWith('1')) { return `+${digits}`; }
    return number; 
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const authenticateAccess = async (req, res, next) => { /* ... */ };
const requireAdmin = (req, res, next) => { /* ... */ };


// ----------------------------------------------------
// --- ROTAS DO CADASTRO (send-otp) ---
// ----------------------------------------------------

app.post('/api/send-otp', async (req, res) => {
    const { name, phone, address } = req.body; 
    
    if (!name || !phone || !address) { return res.status(400).json({ message: 'Todos os campos são obrigatórios.' }); }
    
    const normalizedNumber = normalizePhoneNumber(phone);
    
    if (!normalizedNumber.startsWith('+1') || normalizedNumber.replace(/\D/g, '').length !== 11) {
        return res.status(400).json({ message: 'Número inválido. Use formato EUA.' });
    }

    // 1. Verifica usuário existente (apenas para mensagem)
    let existingUserName = name;
    try {
        const { data: cupons } = await supabase.from('leads_cupons').select('nome').eq('telefone', normalizedNumber).limit(1);
        if (cupons && cupons.length > 0) { existingUserName = cupons[0].nome; }
    } catch (dbError) { return res.status(500).json({ message: 'Erro no banco de dados.' }); }
    
    // 2. GERAÇÃO DE CÓDIGO COM FUSO HORÁRIO UTC (CRIAÇÃO)
    const otpCode = generateOTP();
    // Cria a data de expiração em UTC
    const expiryTime = moment.utc().add(5, 'minutes').toISOString(); 
    
    const otpSessionData = {
        telefone: normalizedNumber,
        codigo_otp: otpCode,
        expira_em: expiryTime, // Salvo como string UTC ISO
    };
    
    try {
        const { error: otpError } = await supabase.from('otp_sessions').upsert([otpSessionData], { onConflict: 'telefone' }); 
        if (otpError) throw otpError;
    } catch (e) {
        console.error('Erro sessão OTP:', e);
        return res.status(500).json({ message: 'Erro ao criar sessão.' });
    }

    // 3. Envio do SMS (Com Bypass de Erro 21608)
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
        // COMPROMISSO DE SEGURANÇA PARA TESTE (se Twilio falhar, fornece o código salvo)
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


app.post('/api/check-otp', async (req, res) => {
    const { phone, code, name, address } = req.body; 
    
    if (!phone || !code || !name || !address) { return res.status(400).json({ message: 'Dados incompletos.' }); }
    
    const phone_with_plus = phone.startsWith('+') ? phone : '+' + phone;

    try {
        const { data: session, error: sessionError } = await supabase
            .from('otp_sessions')
            .select('codigo_otp, expira_em')
            .eq('telefone', phone_with_plus)
            .limit(1);

        if (sessionError || !session || session.length === 0) {
            return res.status(401).json({ message: 'Sessão não encontrada.' });
        }
        
        const storedCode = session[0].codigo_otp;
        
        // CORREÇÃO CRÍTICA: PARSE ZONE para interpretar o offset retornado pelo Supabase
        const expiryTime = moment.parseZone(session[0].expira_em); 
        
        // Compara com o momento atual em UTC (garante universalidade)
        const isExpired = expiryTime.isBefore(moment.utc()); 
        
        const isCodeValid = (code === storedCode);
        
        if (isExpired) {
            await supabase.from('otp_sessions').delete().eq('telefone', phone_with_plus);
            return res.status(401).json({ message: 'Código expirado. Tente novamente.' });
        }
        
        if (!isCodeValid) {
            return res.status(401).json({ message: 'Código inválido.' });
        }

        // --- SUCESSO: Código válido e no prazo ---
        
        await supabase.from('otp_sessions').delete().eq('telefone', phone_with_plus);
        
        // Verifica se é reacesso ou novo cadastro
        const { data: existingCupons } = await supabase.from('leads_cupons').select('*').eq('telefone', phone_with_plus);

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
                telefone: phone_with_plus, 
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