<?xml version="1.0" encoding="UTF-8"?>
<!-- A made-up substation for learning: two feeder protection relays on one station bus. -->
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
    <Header id="Gridlingo sample substation" version="1" revision="1" toolID="Gridlingo"/>
    <Communication>
        <SubNetwork name="StationBus" type="8-MMS">
            <ConnectedAP iedName="F1PROT" apName="S1">
                <Address>
                    <P type="IP">10.0.1.11</P>
                    <P type="IP-SUBNET">255.255.255.0</P>
                </Address>
                <GSE ldInst="LD0" cbName="gcbTrip">
                    <Address>
                        <P type="MAC-Address">01-0C-CD-01-00-01</P>
                        <P type="APPID">0001</P>
                        <P type="VLAN-ID">00A</P>
                        <P type="VLAN-PRIORITY">4</P>
                    </Address>
                    <MinTime unit="s" multiplier="m">2</MinTime>
                    <MaxTime unit="s" multiplier="m">1000</MaxTime>
                </GSE>
            </ConnectedAP>
            <ConnectedAP iedName="F2PROT" apName="S1">
                <Address>
                    <P type="IP">10.0.1.12</P>
                    <P type="IP-SUBNET">255.255.255.0</P>
                </Address>
            </ConnectedAP>
        </SubNetwork>
    </Communication>
    <IED name="F1PROT" manufacturer="Example" type="Feeder protection" configVersion="1.0">
        <AccessPoint name="S1">
            <Server>
                <Authentication/>
                <LDevice inst="LD0" desc="Protection of feeder F1">
                    <LN0 lnClass="LLN0" inst="" lnType="LLN0_PROT">
                        <DataSet name="dsTrip">
                            <FCDA ldInst="LD0" lnClass="PTRC" lnInst="1" doName="Tr" daName="general" fc="ST"/>
                            <FCDA ldInst="LD0" lnClass="PTRC" lnInst="1" doName="Tr" daName="q" fc="ST"/>
                        </DataSet>
                        <GSEControl name="gcbTrip" datSet="dsTrip" confRev="1" appID="F1PROT_Trip" type="GOOSE"/>
                        <DOI name="NamPlt">
                            <DAI name="vendor"><Val>Example</Val></DAI>
                            <DAI name="swRev"><Val>2.1</Val></DAI>
                        </DOI>
                    </LN0>
                    <LN lnClass="LPHD" inst="1" lnType="LPHD_T"/>
                    <LN lnClass="PTOC" inst="1" lnType="PTOC_T" desc="Phase overcurrent"/>
                    <LN lnClass="PTRC" inst="1" lnType="PTRC_T" desc="Trip to breaker Q1"/>
                    <LN lnClass="XCBR" inst="1" lnType="XCBR_T" desc="Breaker Q1">
                        <DOI name="Pos">
                            <DAI name="ctlModel"><Val>status-only</Val></DAI>
                        </DOI>
                    </LN>
                </LDevice>
            </Server>
        </AccessPoint>
    </IED>
    <IED name="F2PROT" manufacturer="Example" type="Feeder protection" configVersion="1.0">
        <AccessPoint name="S1">
            <Server>
                <Authentication/>
                <LDevice inst="LD0" desc="Protection of feeder F2">
                    <LN0 lnClass="LLN0" inst="" lnType="LLN0_PROT">
                        <DOI name="NamPlt">
                            <DAI name="vendor"><Val>Example</Val></DAI>
                            <DAI name="swRev"><Val>2.1</Val></DAI>
                        </DOI>
                    </LN0>
                    <LN lnClass="LPHD" inst="1" lnType="LPHD_T"/>
                    <LN lnClass="RBRF" inst="1" lnType="RBRF_T" desc="Breaker failure, started by F1PROT's trip">
                        <Inputs>
                            <ExtRef iedName="F1PROT" ldInst="LD0" lnClass="PTRC" lnInst="1" doName="Tr" daName="general" serviceType="GOOSE" srcLDInst="LD0" srcCBName="gcbTrip"/>
                        </Inputs>
                    </LN>
                </LDevice>
            </Server>
        </AccessPoint>
    </IED>
    <DataTypeTemplates>
        <LNodeType id="LLN0_PROT" lnClass="LLN0">
            <DO name="Mod" type="ENC_Mod"/>
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Health" type="ENS_Health"/>
            <DO name="NamPlt" type="LPL_T"/>
        </LNodeType>
        <LNodeType id="LPHD_T" lnClass="LPHD">
            <DO name="PhyNam" type="DPL_T"/>
            <DO name="PhyHealth" type="ENS_Health"/>
            <DO name="Proxy" type="SPS_T"/>
        </LNodeType>
        <LNodeType id="PTOC_T" lnClass="PTOC">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Str" type="ACD_T"/>
            <DO name="Op" type="ACT_T"/>
        </LNodeType>
        <LNodeType id="PTRC_T" lnClass="PTRC">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Tr" type="ACT_T"/>
            <DO name="Op" type="ACT_T"/>
        </LNodeType>
        <LNodeType id="XCBR_T" lnClass="XCBR">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Pos" type="DPC_T"/>
        </LNodeType>
        <LNodeType id="RBRF_T" lnClass="RBRF">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="OpEx" type="ACT_T"/>
        </LNodeType>
        <DOType id="ENC_Mod" cdc="ENC">
            <DA name="stVal" bType="Enum" type="BehaviourModeKind" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
            <DA name="ctlModel" bType="Enum" type="CtlModelKind" fc="CF"/>
        </DOType>
        <DOType id="ENS_Beh" cdc="ENS">
            <DA name="stVal" bType="Enum" type="BehaviourModeKind" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
        </DOType>
        <DOType id="ENS_Health" cdc="ENS">
            <DA name="stVal" bType="Enum" type="HealthKind" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
        </DOType>
        <DOType id="LPL_T" cdc="LPL">
            <DA name="vendor" bType="VisString255" fc="DC"/>
            <DA name="swRev" bType="VisString255" fc="DC"/>
            <DA name="d" bType="VisString255" fc="DC"/>
        </DOType>
        <DOType id="DPL_T" cdc="DPL">
            <DA name="vendor" bType="VisString255" fc="DC"/>
            <DA name="serNum" bType="VisString255" fc="DC"/>
        </DOType>
        <DOType id="SPS_T" cdc="SPS">
            <DA name="stVal" bType="BOOLEAN" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
        </DOType>
        <DOType id="ACD_T" cdc="ACD">
            <DA name="general" bType="BOOLEAN" fc="ST"/>
            <DA name="dirGeneral" bType="Enum" type="FaultDirectionKind" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
        </DOType>
        <DOType id="ACT_T" cdc="ACT">
            <DA name="general" bType="BOOLEAN" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
        </DOType>
        <DOType id="DPC_T" cdc="DPC">
            <DA name="stVal" bType="Dbpos" fc="ST"/>
            <DA name="q" bType="Quality" fc="ST"/>
            <DA name="t" bType="Timestamp" fc="ST"/>
            <DA name="ctlModel" bType="Enum" type="CtlModelKind" fc="CF"/>
        </DOType>
        <EnumType id="BehaviourModeKind">
            <EnumVal ord="1">on</EnumVal>
            <EnumVal ord="2">on-blocked</EnumVal>
            <EnumVal ord="3">test</EnumVal>
            <EnumVal ord="4">test/blocked</EnumVal>
            <EnumVal ord="5">off</EnumVal>
        </EnumType>
        <EnumType id="HealthKind">
            <EnumVal ord="1">Ok</EnumVal>
            <EnumVal ord="2">Warning</EnumVal>
            <EnumVal ord="3">Alarm</EnumVal>
        </EnumType>
        <EnumType id="CtlModelKind">
            <EnumVal ord="0">status-only</EnumVal>
            <EnumVal ord="1">direct-with-normal-security</EnumVal>
            <EnumVal ord="2">sbo-with-normal-security</EnumVal>
            <EnumVal ord="3">direct-with-enhanced-security</EnumVal>
            <EnumVal ord="4">sbo-with-enhanced-security</EnumVal>
        </EnumType>
        <EnumType id="FaultDirectionKind">
            <EnumVal ord="0">unknown</EnumVal>
            <EnumVal ord="1">forward</EnumVal>
            <EnumVal ord="2">backward</EnumVal>
            <EnumVal ord="3">both</EnumVal>
        </EnumType>
    </DataTypeTemplates>
</SCL>
