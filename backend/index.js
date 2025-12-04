// ARQUIVO: backend/index.js (VERSÃO FINAL: TIMEZONE UTC + FORMATAÇÃO TELEFONE CORRIGIDA)

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

const VERCEL_FRONTEND_URL = 'https://coupon-sms-proejct-donpedro.vercel.app';

const corsOptions = {
    origin: [VERCEL_FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// --- Funções de Ajuda ---

// Função CRÍTICA para garantir que o número seja sempre igual (+1 para EUA)
const normalizePhoneNumber = (number) => {
    const digits = number.replace(/\D/g, '');
    // Se já tem 11 digitos e começa com 1 (ex: 1267...), é EUA com código de país
    if (digits.length === 11 && digits.startsWith('1')) { return `+${digits}`; }
    // Se tem 10 digitos (ex: 267...), é EUA sem código, adiciona +1
    if (digits.length === 10) { return `+1${digits}`; }
    // Outros casos (Brasil, etc), apenas adiciona +
    return `+${digits}`; 
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ... (Middlewares)
const authenticateAccess = async (req, res, next) => {
    const token = req.header('X-Auth-Token');
    if (!token) { return res.status(401).json({ message: 'Token ausente.' }); }
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
// --- ROTAS DO CADASTRO ---
// ----------------------------------------------------

app.post('/api/send-otp', async (req, res) => {
    const { name, phone, address } = req.body; 
    
    if (!name || !phone || !address) { return res.status(400).json({ message: 'Campos obrigatórios.' }); }
    
    const normalizedNumber = normalizePhoneNumber(phone);
    
    // Validação básica de tamanho (EUA = 12 caracteres com o +1)
    if (!normalizedNumber.startsWith('+') || normalizedNumber.length < 12) {
        return res.status(400).json({ message: 'Número inválido. Use formato com DDD.' });
    }

    let existingUserName = name;
    try {
        const { data: cupons } = await supabase.from('leads_cupons').select('nome').eq('telefone', normalizedNumber).limit(1);
        if (cupons && cupons.length > 0) { existingUserName = cupons[0].nome; }
    } catch (dbError) { return res.status(500).json({ message: 'Erro no banco de dados.' }); }
    
    const otpCode = generateOTP();
    const expiryTime = moment.utc().add(5, 'minutes').toISOString(); 
    
    const otpSessionData = {
        telefone: normalizedNumber,
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
        // Fallback para teste se A2P bloquear (retorna código no JSON)
        if (e.code === 21608 || e.code === 30034) {
            return res.status(200).json({ 
                message: `AVISO (BLOQUEIO TWILIO): Use o código ${otpCode}.`,
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
    
    // >>> CORREÇÃO: USA A MESMA NORMALIZAÇÃO DO SEND-OTP <<<
    const normalizedNumber = normalizePhoneNumber(phone);

    try {
        const { data: session, error: sessionError } = await supabase
            .from('otp_sessions')
            .select('codigo_otp, expira_em')
            .eq('telefone', normalizedNumber) // Busca pelo número formatado corretamente (+1...)
            .limit(1);

        if (sessionError || !session || session.length === 0) {
            // Log para você ver no Render o que está chegando vs o que deveria
            console.log(`Falha Check: Buscado ${normalizedNumber} - Não encontrado.`);
            return res.status(401).json({ message: 'Sessão não encontrada.' });
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
            return res.status(401).json({ message: 'Código incorreto.' });
        }

        // --- SUCESSO ---
        await supabase.from('otp_sessions').delete().eq('telefone', normalizedNumber);
        
        const { data: existingCupons } = await supabase.from('leads_cupons').select('*').eq('telefone', normalizedNumber);

        if (existingCupons && existingCupons.length > 0) {
            const cuponsValidos = existingCupons.filter(c => c.status_uso === 'NAO_UTILIZADO');
            const cupomPrincipal = cuponsValidos.length > 0 ? cuponsValidos[0].coupon_uuid : existingCupons[0].coupon_uuid;

            return res.status(200).json({ 
                message: `Acesso verificado.`,
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
                message: `Cadastro finalizado!`,
                couponUUID: couponUUID, 
                couponCode: FIXED_COUPON_CODE 
            });
        }

    } catch (e) {
        console.error('Erro Check OTP:', e);
        return res.status(500).json({ message: 'Erro interno.' });
    }
});

// ... (Rotas de Login, Validate e Admin mantidas) ...
app.post('/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const { data } = await supabase.from('users_acesso').select('*').eq('usuario', usuario).eq('senha', senha).limit(1);
        if (!data || data.length === 0) { return res.status(401).json({ message: 'Credenciais inválidas.' }); }
        const token = `${data[0].usuario}:${data[0].nivel}`;
        return res.status(200).json({ message: 'Login OK', token, nivel: data[0].nivel });
    } catch (dbError) { return res.status(500).json({ message: 'Erro interno.' }); }
});

app.post('/func/validate', authenticateAccess, async (req, res) => {
    const { couponUUID } = req.body; 
    if (!couponUUID) return res.status(400).json({ message: 'Código obrigatório.' });
    try {
        const { data: coupon } = await supabase.from('leads_cupons').select('*').eq('coupon_uuid', couponUUID).limit(1);
        if (!coupon || coupon.length === 0) return res.status(404).json({ message: 'Cupom não encontrado.' });
        if (coupon[0].status_uso === 'UTILIZADO') return res.status(409).json({ message: `Cupom já utilizado por ${coupon[0].nome}.` });
        if (coupon[0].status_uso === 'EXPIRADO') return res.status(409).json({ message: 'Cupom expirado.' });
        await supabase.from('leads_cupons').update({ status_uso: 'UTILIZADO', data_uso: new Date().toISOString() }).eq('coupon_uuid', couponUUID);
        return res.status(200).json({ message: `CUPOM VÁLIDO! Registrado para ${coupon[0].nome}.`, status: 'VALIDADO', nome: coupon[0].nome });
    } catch (dbError) { return res.status(500).json({ message: 'Erro na validação.' }); }
});

app.get('/admin/leads', authenticateAccess, requireAdmin, async (req, res) => {
    try {
        const { data: leads } = await supabase.from('leads_cupons').select('*');
        return res.status(200).json(leads);
    } catch (dbError) { return res.status(500).json({ message: 'Erro ao buscar dados.' }); }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});