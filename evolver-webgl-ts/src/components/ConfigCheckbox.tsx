import * as React from "react";

export interface ConfigCheckboxProps {
    label: string;
    value: boolean;
    onUpdate: (newValue: boolean) => void;
}

export class ConfigCheckbox extends React.Component<ConfigCheckboxProps> {

    renderButton() {
        if (this.props.value) {
            return <i className="fa fa-check-square-o"></i>;
        }
        return <i className="fa fa-square-o"></i>;
    }

    render() {
        return <div className="row config-item">
            <label className="col-sm-6">{this.props.label}</label>
            <div className="col-sm-6">
                <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdate(!this.props.value)}>
                    {this.renderButton()}
                </button>
            </div>
        </div>;
    }
}
