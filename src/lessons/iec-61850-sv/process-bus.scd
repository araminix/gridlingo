<?xml version="1.0" encoding="UTF-8"?>
<!-- A made-up process bus for learning: one merging unit streams the currents and voltages of feeder F1 to its relay. -->
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4">
    <Header id="Gridlingo sample process bus" version="1" revision="1" toolID="Gridlingo"/>
    <Communication>
        <SubNetwork name="ProcessBus">
            <ConnectedAP iedName="F1MU" apName="P1">
                <SMV ldInst="MU01" cbName="MSVCB01">
                    <Address>
                        <P type="MAC-Address">01-0C-CD-04-00-01</P>
                        <P type="APPID">4000</P>
                        <P type="VLAN-ID">014</P>
                        <P type="VLAN-PRIORITY">4</P>
                    </Address>
                </SMV>
            </ConnectedAP>
            <ConnectedAP iedName="F1PROT" apName="P1"/>
        </SubNetwork>
    </Communication>
    <IED name="F1MU" manufacturer="Example" type="Merging unit" configVersion="1.0">
        <AccessPoint name="P1">
            <Server>
                <Authentication/>
                <LDevice inst="MU01" desc="Currents and voltages of feeder F1">
                    <LN0 lnClass="LLN0" inst="" lnType="LLN0_MU">
                        <DataSet name="PhsMeas1">
                            <FCDA ldInst="MU01" lnClass="TCTR" lnInst="1" doName="Amp" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TCTR" lnInst="2" doName="Amp" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TCTR" lnInst="3" doName="Amp" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TCTR" lnInst="4" doName="Amp" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TVTR" lnInst="1" doName="Vol" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TVTR" lnInst="2" doName="Vol" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TVTR" lnInst="3" doName="Vol" fc="MX"/>
                            <FCDA ldInst="MU01" lnClass="TVTR" lnInst="4" doName="Vol" fc="MX"/>
                        </DataSet>
                        <SampledValueControl name="MSVCB01" datSet="PhsMeas1" confRev="1" smvID="F1MUSV01" multicast="true" smpRate="80" nofASDU="1">
                            <SmvOpts refreshTime="false" sampleRate="false" dataSet="false" security="false"/>
                        </SampledValueControl>
                    </LN0>
                    <LN lnClass="LPHD" inst="1" lnType="LPHD_T"/>
                    <LN lnClass="TCTR" inst="1" lnType="TCTR_T" desc="Phase A current">
                        <DOI name="Amp">
                            <SDI name="sVC">
                                <DAI name="scaleFactor"><Val>0.001</Val></DAI>
                                <DAI name="offset"><Val>0</Val></DAI>
                            </SDI>
                        </DOI>
                    </LN>
                    <LN lnClass="TCTR" inst="2" lnType="TCTR_T" desc="Phase B current"/>
                    <LN lnClass="TCTR" inst="3" lnType="TCTR_T" desc="Phase C current"/>
                    <LN lnClass="TCTR" inst="4" lnType="TCTR_T" desc="Neutral current"/>
                    <LN lnClass="TVTR" inst="1" lnType="TVTR_T" desc="Phase A voltage">
                        <DOI name="Vol">
                            <SDI name="sVC">
                                <DAI name="scaleFactor"><Val>0.01</Val></DAI>
                                <DAI name="offset"><Val>0</Val></DAI>
                            </SDI>
                        </DOI>
                    </LN>
                    <LN lnClass="TVTR" inst="2" lnType="TVTR_T" desc="Phase B voltage"/>
                    <LN lnClass="TVTR" inst="3" lnType="TVTR_T" desc="Phase C voltage"/>
                    <LN lnClass="TVTR" inst="4" lnType="TVTR_T" desc="Neutral voltage"/>
                </LDevice>
            </Server>
        </AccessPoint>
    </IED>
    <IED name="F1PROT" manufacturer="Example" type="Feeder protection" configVersion="1.0">
        <AccessPoint name="P1">
            <Server>
                <Authentication/>
                <LDevice inst="LD0" desc="Protection of feeder F1, on sampled values">
                    <LN0 lnClass="LLN0" inst="" lnType="LLN0_PROT"/>
                    <LN lnClass="LPHD" inst="1" lnType="LPHD_T"/>
                    <LN lnClass="PTOC" inst="1" lnType="PTOC_T" desc="Phase and earth overcurrent">
                        <Inputs>
                            <ExtRef iedName="F1MU" ldInst="MU01" lnClass="TCTR" lnInst="1" doName="Amp" serviceType="SMV" srcLDInst="MU01" srcCBName="MSVCB01"/>
                            <ExtRef iedName="F1MU" ldInst="MU01" lnClass="TCTR" lnInst="2" doName="Amp" serviceType="SMV" srcLDInst="MU01" srcCBName="MSVCB01"/>
                            <ExtRef iedName="F1MU" ldInst="MU01" lnClass="TCTR" lnInst="3" doName="Amp" serviceType="SMV" srcLDInst="MU01" srcCBName="MSVCB01"/>
                            <ExtRef iedName="F1MU" ldInst="MU01" lnClass="TCTR" lnInst="4" doName="Amp" serviceType="SMV" srcLDInst="MU01" srcCBName="MSVCB01"/>
                        </Inputs>
                    </LN>
                    <LN lnClass="PTRC" inst="1" lnType="PTRC_T" desc="Trip to breaker Q1, by GOOSE to F1MU"/>
                </LDevice>
            </Server>
        </AccessPoint>
    </IED>
    <DataTypeTemplates>
        <LNodeType id="LLN0_MU" lnClass="LLN0">
            <DO name="Mod" type="ENC_Mod"/>
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Health" type="ENS_Health"/>
            <DO name="NamPlt" type="LPL_T"/>
        </LNodeType>
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
        <LNodeType id="TCTR_T" lnClass="TCTR">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Amp" type="SAV_Amp"/>
        </LNodeType>
        <LNodeType id="TVTR_T" lnClass="TVTR">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Vol" type="SAV_Vol"/>
        </LNodeType>
        <LNodeType id="PTOC_T" lnClass="PTOC">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Str" type="ACD_T"/>
            <DO name="Op" type="ACT_T"/>
        </LNodeType>
        <LNodeType id="PTRC_T" lnClass="PTRC">
            <DO name="Beh" type="ENS_Beh"/>
            <DO name="Tr" type="ACT_T"/>
        </LNodeType>
        <DOType id="SAV_Amp" cdc="SAV">
            <DA name="instMag" bType="Struct" type="AnalogueValue_I" fc="MX"/>
            <DA name="q" bType="Quality" fc="MX"/>
            <DA name="sVC" bType="Struct" type="ScaledValueConfig" fc="CF"/>
        </DOType>
        <DOType id="SAV_Vol" cdc="SAV">
            <DA name="instMag" bType="Struct" type="AnalogueValue_I" fc="MX"/>
            <DA name="q" bType="Quality" fc="MX"/>
            <DA name="sVC" bType="Struct" type="ScaledValueConfig" fc="CF"/>
        </DOType>
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
        <DAType id="AnalogueValue_I">
            <BDA name="i" bType="INT32"/>
        </DAType>
        <DAType id="ScaledValueConfig">
            <BDA name="scaleFactor" bType="FLOAT32"/>
            <BDA name="offset" bType="FLOAT32"/>
        </DAType>
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
