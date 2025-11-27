// ARQUIVO: coupon-sms-project/backend/index.js (VERSÃO FINAL COM REACESSO SEGURO)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio'); 
const moment = require('moment-timezone'); // Garanta que npm install moment-timezone foi executado

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configurações Fixas e Chaves ---
const FIXED_COUPON_CODE = "D0nP3dro20"; 

const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], 
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

// --- Funções de Ajuda e Middlewares ---

/** Normaliza o número de telefone para o formato E.164 (+1xxxxxxxxxx). */
const normalizePhoneNumber = (number) => {
    const digits = number.replace(/\D/g, '');
    if (number.startsWith('+')) { return number; }
    if (digits.length === 10) { return `+1${digits}`; }
    if (digits.length === 11 && digits.startsWith('1')) { return `+${digits}`; }
    return number; 
};

/** Gera um código OTP aleatório de 6 dígitos. */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const authenticateAccess = async (req, res, next) => {
    const token = req.header('X-Auth-Token');
    if (!token) { return res.status(401).json({ message: 'Token de autenticação ausente.' }); }
    try {
        const [usuario, nivel] = token.split(':');
        const { data, error } = await supabase
            .from('users_acesso')
            .select('nivel')
            .eq('usuario', usuario)
            .limit(1);
        if (error || !data || data.length === 0) {
            return res.status(401).json({ message: 'Usuário não encontrado ou token inválido.' });
        }
        req.user_nivel = data[0].nivel; 
        req.user_usuario = usuario;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Formato de token inválido.' });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user_nivel !== 'ADMIN') {
        return res.status(403).json({ message: 'Acesso negado. Requer privilégios de Administrador.' });
    }
    next();
};


// ----------------------------------------------------
// --- ROTAS DO CADASTRO (ETAPA 1: ENVIAR SMS) ---
// ----------------------------------------------------

app.post('/api/send-otp', async (req, res) => {
    const { name, phone, address } = req.body; 
    
    if (!name || !phone || !address) {
        return res.status(400).json({ message: 'Nome, telefone e endereço são obrigatórios.' });
    }
    
    const normalizedNumber = normalizePhoneNumber(phone);
    
    if (!normalizedNumber.startsWith('+1') || normalizedNumber.replace(/\D/g, '').length !== 11) {
        return res.status(400).json({ message: 'Formato de número inválido. Use o formato dos EUA.' });
    }

    // 1. VERIFICAR SE O USUÁRIO É ANTIGO OU NOVO
    let isExistingUser = false;
    let existingUserName = name;
    try {
        const { data: cupons } = await supabase
            .from('leads_cupons')
            .select('nome')
            .eq('telefone', normalizedNumber)
            .limit(1);

        if (cupons && cupons.length > 0) {
            isExistingUser = true;
            existingUserName = cupons[0].nome; // Mantém o nome cadastrado
        }
    } catch (dbError) {
        console.error('Erro ao consultar Supabase (Cadastro):', dbError);
        return res.status(500).json({ message: 'Erro interno ao consultar banco de dados.' });
    }
    
    // 2. GERAR CÓDIGO E SALVAR SESSÃO TEMPORÁRIA
    const otpCode = generateOTP();
    const expiryTime = moment().add(5, 'minutes').toISOString(); // Código expira em 5 minutos
    
    const otpSessionData = {
        telefone: normalizedNumber,
        codigo_otp: otpCode,
        expira_em: expiryTime,
    };
    
    try {
        // Tenta inserir ou atualizar a sessão OTP
        const { error: otpError } = await supabase
            .from('otp_sessions')
            .upsert([otpSessionData], { onConflict: 'telefone' }); 

        if (otpError) throw otpError;

    } catch (e) {
        console.error('Erro ao salvar sessão OTP:', e);
        return res.status(500).json({ message: 'Erro ao criar sessão de validação.' });
    }

    // 3. ENVIAR CÓDIGO VIA TWILIO MESSAGES PADRÃO
    try {
        await twilioClient.messages.create({
            body: `Seu código de verificação DONPEDRO é ${otpCode}. Válido por 5 minutos.`,
            from: process.env.TWILIO_PHONE_NUMBER, 
            to: normalizedNumber, 
        });

        // Sucesso: Retorna o status e se é um usuário antigo (para a mensagem)
        return res.status(200).json({ 
            message: isExistingUser 
                     ? `Olá ${existingUserName}, o código foi enviado para revalidação.` 
                     : `Código de verificação enviado para ${normalizedNumber}.`,
            phone: normalizedNumber, 
            status: 'pending',
            isExistingUser: isExistingUser // INFORMA O FRONT SOBRE O STATUS
        });

    } catch (e) {
        console.error('Erro Twilio Messages (Envio):', e);
        return res.status(500).json({ message: 'Erro ao enviar o SMS. Verifique se o número está verificado no Twilio (erro 21608).'});
    }
});


// ----------------------------------------------------
// --- ROTAS DO CADASTRO (ETAPA 2: VALIDAR E FINALIZAR) ---
// ----------------------------------------------------

app.post('/api/check-otp', async (req, res) => {
    const { phone, code, name, address } = req.body; 
    
    if (!phone || !code || !name || !address) {
        return res.status(400).json({ message: 'Dados de validação incompletos.' });
    }
    
    const phone_with_plus = phone.startsWith('+') ? phone : '+' + phone;

    // 1. VERIFICAR O CÓDIGO E TEMPO DE EXPIRAÇÃO NO SUPABASE (A SEGURANÇA)
    try {
        const { data: session, error: sessionError } = await supabase
            .from('otp_sessions')
            .select('codigo_otp, expira_em')
            .eq('telefone', phone_with_plus)
            .limit(1);

        if (sessionError || !session || session.length === 0) {
            return res.status(401).json({ message: 'Sessão de verificação não encontrada ou expirada.' });
        }
        
        const storedCode = session[0].codigo_otp;
        const expiryTime = moment(session[0].expira_em);
        
        const isCodeValid = (code === storedCode);
        const isExpired = expiryTime.isBefore(moment()); 
        
        // 2. CÓDIGO INVÁLIDO OU EXPIRADO
        if (isExpired) {
            await supabase.from('otp_sessions').delete().eq('telefone', phone_with_plus);
            return res.status(401).json({ message: 'Código expirado. Tente o cadastro novamente.' });
        }
        
        if (!isCodeValid) {
            return res.status(401).json({ message: 'Código de verificação inválido.' });
        }

        // 3. CÓDIGO APROVADO: DECISÃO (NOVO CADASTRO VS REACESSO)
        
        // Limpa a sessão OTP imediatamente após o código ser aprovado
        await supabase.from('otp_sessions').delete().eq('telefone', phone_with_plus);
        
        // --- AQUI ESTÁ A LÓGICA DE SEGURANÇA DE REACESSO ---
        const { data: existingCupons } = await supabase
            .from('leads_cupons')
            .select('*')
            .eq('telefone', phone_with_plus);

        if (existingCupons && existingCupons.length > 0) {
            // FLUXO DE REACESSO: Usuário validou o telefone, retorna o QR Code existente
            const cuponsValidos = existingCupons.filter(c => c.status_uso === 'NAO_UTILIZADO');
            const cupomPrincipal = cuponsValidos.length > 0 ? cuponsValidos[0].coupon_uuid : existingCupons[0].coupon_uuid;

            return res.status(200).json({ 
                message: `Acesso verificado. Cupons disponíveis para ${existingCupons[0].nome}.`,
                couponUUID: cupomPrincipal, 
                couponCode: FIXED_COUPON_CODE,
                isExistingUser: true
            });

        } else {
            // FLUXO DE NOVO CADASTRO: Insere no DB (após 100% de certeza do OTP)
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
                message: `Verificação concluída. Cadastro finalizado!`,
                couponUUID: couponUUID, 
                couponCode: FIXED_COUPON_CODE 
            });
        }


    } catch (e) {
        console.error('Erro na Checagem OTP/DB:', e);
        return res.status(500).json({ message: 'Erro interno ao validar o código ou salvar o cadastro.' });
    }
});


// ----------------------------------------------------
// --- ROTAS DE ACESSO (FUNCIONÁRIO & ADMIN) e LISTEN ---
// ----------------------------------------------------

/** Rota de Login */
app.post('/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const { data, error } = await supabase
            .from('users_acesso')
            .select('usuario, nivel')
            .eq('usuario', usuario)
            .eq('senha', senha)
            .limit(1);

        if (error || !data || data.length === 0) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        
        const token = `${data[0].usuario}:${data[0].nivel}`;
        return res.status(200).json({ 
            message: 'Login bem-sucedido.', 
            token: token,
            nivel: data[0].nivel
        });

    } catch (dbError) {
        console.error('Erro de login:', dbError);
        return res.status(500).json({ message: 'Erro interno no servidor de autenticação.' });
    }
});

/** Rota de Validação/Scanner (Funcionário) */
app.post('/func/validate', authenticateAccess, async (req, res) => {
    const { couponUUID } = req.body; 
    
    if (req.user_nivel !== 'FUNCIONARIO' && req.user_nivel !== 'ADMIN') {
         return res.status(403).json({ message: 'Acesso negado. Requer nível de Funcionário ou Admin.' });
    }
    
    if (!couponUUID) {
        return res.status(400).json({ message: 'O código UUID do cupom é obrigatório.' });
    }

    try {
        const { data: coupon, error: fetchError } = await supabase
            .from('leads_cupons')
            .select('status_uso, nome')
            .eq('coupon_uuid', couponUUID)
            .limit(1);

        if (fetchError) throw fetchError;
        
        if (!coupon || coupon.length === 0) {
            return res.status(404).json({ message: 'Código QR Inválido. Cupom não encontrado.' });
        }
        
        const currentStatus = coupon[0].status_uso;

        if (currentStatus === 'UTILIZADO') {
            return res.status(409).json({ message: `Cupom já utilizado por ${coupon[0].nome}. Validação negada.` });
        }
        if (currentStatus === 'EXPIRADO') {
            return res.status(409).json({ message: 'Cupom expirado. Validação negada.' });
        }

        const { error: updateError } = await supabase
            .from('leads_cupons')
            .update({ status_uso: 'UTILIZADO', data_uso: new Date().toISOString() })
            .eq('coupon_uuid', couponUUID);

        if (updateError) throw updateError;
        
        return res.status(200).json({ 
            message: `CUPOM VÁLIDO! Uso registrado para ${coupon[0].nome}.`,
            status: 'VALIDADO',
            nome: coupon[0].nome
        });

    } catch (dbError) {
        console.error('Erro de validação:', dbError);
        return res.status(500).json({ message: 'Erro interno no servidor de validação.' });
    }
});


/** Rota para Obter Leads (Apenas Admin) */
app.get('/admin/leads', authenticateAccess, requireAdmin, async (req, res) => {
    try {
        const { data: leads, error } = await supabase
            .from('leads_cupons')
            .select('coupon_uuid, nome, telefone, endereco, status_uso, data_cadastro, data_uso');

        if (error) throw error;
        
        return res.status(200).json(leads);

    } catch (dbError) {
        console.error('Erro ao buscar leads:', dbError);
        return res.status(500).json({ message: 'Erro interno ao carregar dados.' });
    }
});


// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});